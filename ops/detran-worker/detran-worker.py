#!/usr/bin/env python3
# -*- coding: utf-8 -*-
# ---------------------------------------------------------------------------
# detran-worker: ponte HTTP INTERNA entre o container Nuxt e a consulta DETRAN-SP.
#
# MOTOR (caminho B, rework 24/set): em vez de navegar a SPA (~66s), o worker
# extrai UMA sessao pelo browser (login gov.br + bridge + CDP getAllCookies +
# window.g_ck), cacheia por 25min, e faz os 4 GETs da API interna do ServiceNow
# em HTTP PURO (~2s). A navegacao antiga (runner) fica como FALLBACK (plano B).
#
#   POST /consultar {placa, renavam, uf?} + header X-Worker-Secret
#     -> garante sessao valida (extrai via browser se velha/ausente)
#     -> detran_api.consultar_api(sessao, placa, renavam)  [HTTP puro]
#     -> 401/403 (sessao caiu): re-extrai 1x e repete
#     -> qualquer falha: FALLBACK pro runner de navegacao; senao fail-open
#
# LGPD: o base da API traz nome + CPF/CNPJ do proprietario. O parser
# (detran_api) NUNCA le nem persiste isso -- so campos tecnicos do veiculo.
#
# Seguranca: NUNCA escuta em 0.0.0.0. Bind no gateway do bridge coolify
# (10.0.1.1) + segredo no header (constant-time). Concorrencia = 1 (o profile
# gov.br e unico; extracao/consulta simultaneas se atropelam) -> lock global.
# Lifecycle do daemon: start-on-demand + idle-stop. A sessao (cookie+g_ck)
# persiste em arquivo pra sobreviver a restart do worker.
# ---------------------------------------------------------------------------
import hmac
import json
import os
import subprocess
import sys
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import detran_api  # noqa: E402  (modulo irmao no mesmo diretorio)

BIND_HOST = os.environ.get("DETRAN_WORKER_HOST", "10.0.1.1")  # gateway bridge coolify; NUNCA 0.0.0.0
BIND_PORT = int(os.environ.get("DETRAN_WORKER_PORT", "8477"))
SECRET = os.environ.get("DETRAN_WORKER_SECRET", "")
DAEMON = os.environ.get("DETRAN_DAEMON", "pcdetran")
PROFILE = os.environ.get("DETRAN_PROFILE", "gov-br")
RUNNER = os.environ.get("DETRAN_RUNNER", "/root/detran-sp-runner.py")
HARNESS = os.environ.get("BROWSER_HARNESS_BIN", os.path.expanduser("~/.local/bin/browser-harness"))
LOCAL_BIN = os.path.dirname(HARNESS) or os.path.expanduser("~/.local/bin")
SESSION_FILE = os.environ.get("DETRAN_SESSION_FILE", "/opt/detran-worker/session.json")
SESSION_TTL_S = int(os.environ.get("DETRAN_SESSION_TTL_S", "1500"))  # 25 min (TTL real ~30min FIXO)
IDLE_STOP_S = int(os.environ.get("DETRAN_IDLE_STOP_S", "600"))
EXTRACT_TIMEOUT_S = int(os.environ.get("DETRAN_EXTRACT_TIMEOUT_S", "180"))  # browser + login gov.br
RUN_TIMEOUT_S = int(os.environ.get("DETRAN_RUN_TIMEOUT_S", "220"))  # fallback runner (navegacao)
START_TIMEOUT_S = int(os.environ.get("DETRAN_START_TIMEOUT_S", "120"))
API_TIMEOUT_S = int(os.environ.get("DETRAN_API_TIMEOUT_S", "30"))
LOCK_WAIT_S = int(os.environ.get("DETRAN_LOCK_WAIT_S", "8"))

_consulta_lock = threading.Lock()   # concorrencia = 1 (consulta E extracao)
_daemon_lock = threading.Lock()
_session_lock = threading.Lock()
_session = [None]                   # cache em memoria: dict {cookie,g_ck,ua,extracted_at} | None
_last_use = [0.0]


def log(*a):
    print("[detran-worker]", *a, file=sys.stderr, flush=True)


def _env(extra=None):
    e = dict(os.environ)
    e["PATH"] = LOCAL_BIN + ":" + e.get("PATH", "")
    e["BU_NAME"] = DAEMON
    if extra:
        e.update(extra)
    return e


def _run_harness_script(script, extra_env=None, timeout=RUN_TIMEOUT_S):
    return subprocess.run(
        [HARNESS], input=script, capture_output=True, text=True,
        timeout=timeout, env=_env(extra_env),
    )


def _extrai_json_marcado(out):
    """Le o bloco <<<JSON>>> ... <<<END>>> do stdout do harness."""
    i = out.find("<<<JSON>>>")
    j = out.find("<<<END>>>", i) if i >= 0 else -1
    if i < 0 or j < 0:
        return None
    try:
        return json.loads(out[i + len("<<<JSON>>>"):j].strip())
    except Exception:
        return None


# ---- daemon (cloud browser) lifecycle --------------------------------------

def daemon_alive():
    try:
        r = subprocess.run(
            [HARNESS, "doctor", "--json", "--require-existing-daemon"],
            capture_output=True, text=True, timeout=25,
            env=_env({"BH_REQUIRE_EXISTING_DAEMON": "1"}),
        )
        return r.returncode == 0
    except Exception as e:
        log("doctor falhou:", repr(e)[:120])
        return False


def ensure_daemon():
    with _daemon_lock:
        if daemon_alive():
            return True
        log("daemon nao vivo; subindo cloud browser com profile", PROFILE)
        # O heredoc TEM que comecar com start_remote_daemon( senao o harness
        # tenta um Chrome local (inexistente no host) e falha.
        script = 'start_remote_daemon("%s", profileName="%s", proxyCountryCode="br")\n' % (DAEMON, PROFILE)
        try:
            r = _run_harness_script(script, timeout=START_TIMEOUT_S)
            ok = daemon_alive()
            log("start daemon ->", "ok" if ok else "falhou", "|", (r.stdout or "")[-160:].replace("\n", " "))
            return ok
        except Exception as e:
            log("start_remote_daemon falhou:", repr(e)[:160])
            return False


def stop_daemon():
    with _daemon_lock:
        if not daemon_alive():
            return
        try:
            _run_harness_script('stop_remote_daemon("%s")\n' % DAEMON, timeout=30)
            log("daemon parado por ociosidade")
        except Exception as e:
            log("stop_remote_daemon falhou:", repr(e)[:120])


def idle_watch():
    while True:
        time.sleep(30)
        if _last_use[0] and (time.time() - _last_use[0]) > IDLE_STOP_S:
            if _consulta_lock.acquire(blocking=False):
                try:
                    stop_daemon()
                    _last_use[0] = 0.0
                finally:
                    _consulta_lock.release()


# ---- sessao (extracao via browser + cache) ---------------------------------
# Script do harness: login gov.br (auto) + bridge -> jar COMPLETO via CDP
# (httpOnly incluso, que document.cookie NAO ve) + g_ck. Baseado no POC provado
# /root/detran-poc/detran-extract2.py. Imprime <<<JSON>>>{cookie,g_ck,ua}<<<END>>>.
EXTRACT_SCRIPT = r'''
import json, time
def jss(e,d=None):
    try: return js("(()=>{try{return (%s)}catch(_){return %s}})()"%(e,json.dumps(d)))
    except Exception: return d
def body(): return (jss("document.body?document.body.innerText:''","")or"")
def url(): return jss("location.href","")or""
new_tab("https://www.detran.sp.gov.br/detransp/pb/servicos/veiculos/consultar_debitos_restricoes?id=consultar_debitos_restricoes")
for _ in range(20):
    if jss("document.readyState==='complete'&&!!document.body",False): break
    wait(1)
wait(2)
if "entrar com gov.br" in body().lower():
    i=jss("""(()=>{const els=[...document.querySelectorAll('a,button,span,div')].filter(e=>e.offsetParent&&((e.innerText||'').trim().toLowerCase()==='entrar com gov.br')&&e.children.length<=2);if(!els.length)return null;const b=els[0];b.scrollIntoView();const r=b.getBoundingClientRect();return{x:Math.round(r.left+r.width/2),y:Math.round(r.top+r.height/2)}})()""",None)
    if i:
        try: click_at_xy(i["x"],i["y"])
        except Exception: pass
    wait(4)
cred=dict(l.split("=",1) for l in open("/root/.secrets/govbr.env").read().strip().split("\n") if "=" in l)
if "sso.acesso.gov.br" in url() and jss("!!document.querySelector('input#accountId')",False):
    fill_input("input#accountId",cred["GOVBR_CPF"]); wait(2)
    for _ in range(20):
        if jss("(()=>{const b=document.getElementById('enter-account-id');return !!b&&!b.disabled})()",False): break
        wait(1)
    jss("document.getElementById('enter-account-id')&&document.getElementById('enter-account-id').click()",False)
    for _ in range(10):
        wait(5)
        if jss("!!document.querySelector('input[type=password]')",False): break
    if jss("!!document.querySelector('input[type=password]')",False):
        fill_input("input[type=password]",cred["GOVBR_SENHA"]); wait(1)
        jss("(()=>{const b=[...document.querySelectorAll('button')].find(e=>/entrar/i.test(e.innerText||''));b&&b.click()})()",False)
for _ in range(30):
    wait(2)
    if "detran.sp.gov.br" in url() and jss("window.g_ck?String(window.g_ck).length:0",0)==72 and "CESAR" in body().upper(): break
logged = "CESAR" in body().upper() and jss("window.g_ck?String(window.g_ck).length:0",0)==72
if logged:
    gck = jss("window.g_ck","") or ""
    allck = cdp("Network.getAllCookies")
    cks = (allck or {}).get("cookies", [])
    det = [c for c in cks if "detran.sp.gov.br" in (c.get("domain","") or "")]
    cookie_str = "; ".join("%s=%s"%(c["name"],c["value"]) for c in det)
    ua = jss("navigator.userAgent","") or ""
    print("<<<JSON>>>")
    print(json.dumps({"cookie": cookie_str, "g_ck": gck, "ua": ua, "extracted_at": int(time.time()),
                      "n_cookies_detran": len(det), "httponly": sorted(c["name"] for c in det if c.get("httpOnly"))}, ensure_ascii=False))
    print("<<<END>>>")
else:
    print("<<<JSON>>>"); print(json.dumps({"erro": "nao-logou", "amostra": body()[:120]})); print("<<<END>>>")
'''


def _session_valida(s):
    return bool(
        s and s.get("g_ck") and s.get("cookie")
        and (time.time() - float(s.get("extracted_at") or 0)) < SESSION_TTL_S
    )


def _carrega_sessao_do_disco():
    try:
        with open(SESSION_FILE, "r", encoding="utf-8") as f:
            s = json.load(f)
        if _session_valida(s):
            _session[0] = s
            log("sessao carregada do disco, idade %.0fmin" % ((time.time() - s["extracted_at"]) / 60))
    except Exception:
        pass


def _salva_sessao(s):
    try:
        os.makedirs(os.path.dirname(SESSION_FILE), exist_ok=True)
        with open(SESSION_FILE, "w", encoding="utf-8") as f:
            json.dump(s, f, ensure_ascii=False)
        os.chmod(SESSION_FILE, 0o600)  # cookies de sessao = credencial
    except Exception as e:
        log("nao salvou sessao:", repr(e)[:100])


def extrai_sessao():
    """Sobe o daemon, roda o script de extracao no browser e cacheia a sessao.
    Devolve o dict da sessao ou None. Deve ser chamado sob _consulta_lock."""
    if not ensure_daemon():
        log("extracao: daemon nao subiu")
        return None
    try:
        r = _run_harness_script(EXTRACT_SCRIPT, timeout=EXTRACT_TIMEOUT_S)
    except subprocess.TimeoutExpired:
        log("extracao: timeout")
        return None
    except Exception as e:
        log("extracao: erro", repr(e)[:120])
        return None
    s = _extrai_json_marcado(r.stdout or "")
    if not s or s.get("erro") or not s.get("g_ck") or not s.get("cookie"):
        log("extracao: sem sessao util |", (s or {}).get("erro"), "|", (r.stdout or "")[-160:].replace("\n", " "))
        return None
    _session[0] = s
    _salva_sessao(s)
    log("sessao NOVA extraida: %d cookies detran (httpOnly: %s)" % (s.get("n_cookies_detran", 0), s.get("httponly")))
    return s


def get_sessao(force=False):
    """Sessao valida do cache, ou extrai uma nova. Chamar sob _consulta_lock."""
    with _session_lock:
        if not force and _session_valida(_session[0]):
            return _session[0]
    return extrai_sessao()


# ---- fallback: runner de navegacao (plano B) -------------------------------

def fallback_runner(placa, renavam, uf):
    """Motor antigo (navegacao da SPA). Usado se a API/extracao falhar."""
    log("fallback: runner de navegacao para", placa)
    if not ensure_daemon():
        return {"ok": False, "stage": "daemon-nao-subiu", "placa": placa, "renavam": renavam}
    try:
        with open(RUNNER, "r", encoding="utf-8") as f:
            script = f.read()
    except Exception as e:
        return {"ok": False, "stage": "runner-nao-lido", "erro": repr(e)[:120]}
    try:
        r = _run_harness_script(script, extra_env={"PLACA": placa, "RENAVAM": renavam})
    except subprocess.TimeoutExpired:
        return {"ok": False, "stage": "runner-timeout", "placa": placa, "renavam": renavam}
    except Exception as e:
        return {"ok": False, "stage": "runner-erro", "erro": repr(e)[:120]}
    res = _extrai_json_marcado(r.stdout or "")
    if res is None:
        return {"ok": False, "stage": "sem-json-do-runner", "amostra": (r.stdout or "")[-400:]}
    # Defense-in-depth (LGPD/credencial): o `log` do runner e o passo-a-passo da
    # navegacao e o Nuxt grava a resposta em multas_consultas.bruto. Mesmo o
    # runner ja mascarando CPF/senha, esse log NAO precisa ser persistido -- o
    # Nuxt so le os campos do contrato. Removo aqui, na fronteira do worker.
    if isinstance(res, dict):
        res.pop("log", None)
    return res


# ---- consulta (API direta, com fallback) -----------------------------------

def consultar(placa, renavam, uf):
    """Motor API: sessao-cache + 4 GETs. 401/403 -> re-extrai 1x. Falha -> runner."""
    s = get_sessao()
    if not s:
        return fallback_runner(placa, renavam, uf)
    for tentativa in (1, 2):
        try:
            return detran_api.consultar_api(s, placa, renavam, timeout=API_TIMEOUT_S)
        except detran_api.SessaoExpirada:
            if tentativa == 1:
                log("sessao expirada no meio; re-extraindo")
                s = get_sessao(force=True)
                if not s:
                    return fallback_runner(placa, renavam, uf)
                continue
            return fallback_runner(placa, renavam, uf)
        except Exception as e:
            log("consulta API erro:", repr(e)[:140], "-> fallback")
            return fallback_runner(placa, renavam, uf)
    return fallback_runner(placa, renavam, uf)


# ---- HTTP server -----------------------------------------------------------

class Handler(BaseHTTPRequestHandler):
    def _send(self, code, obj):
        body = json.dumps(obj, ensure_ascii=False).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        try:
            self.wfile.write(body)
        except Exception:
            pass

    def _autorizado(self):
        got = self.headers.get("X-Worker-Secret", "")
        return bool(SECRET) and hmac.compare_digest(got, SECRET)

    def do_GET(self):
        if self.path.rstrip("/") == "/health":
            s = _session[0]
            idade = int(time.time() - s["extracted_at"]) if s and s.get("extracted_at") else None
            return self._send(200, {"ok": True, "daemon_alive": daemon_alive(),
                                    "sessao_valida": _session_valida(s), "sessao_idade_s": idade})
        return self._send(404, {"ok": False, "stage": "rota"})

    def do_POST(self):
        # /warm: re-extrai a sessao (pre-warm agendado no pico), pra a 1a consulta
        # do cliente nao pagar o cold-start do browser+login.
        if self.path.rstrip("/") == "/warm":
            if not self._autorizado():
                return self._send(401, {"ok": False, "stage": "auth"})
            if not _consulta_lock.acquire(timeout=LOCK_WAIT_S):
                return self._send(429, {"ok": False, "stage": "ocupado"})
            try:
                s = get_sessao(force=True)
                _last_use[0] = time.time()
                return self._send(200, {"ok": bool(s), "warm": True,
                                        "sessao_valida": _session_valida(s),
                                        "n_cookies_detran": (s or {}).get("n_cookies_detran")})
            finally:
                _consulta_lock.release()
        if self.path.rstrip("/") != "/consultar":
            return self._send(404, {"ok": False, "stage": "rota"})
        if not self._autorizado():
            return self._send(401, {"ok": False, "stage": "auth"})
        try:
            n = int(self.headers.get("Content-Length", "0") or "0")
            body = json.loads(self.rfile.read(n) or b"{}") if n else {}
        except Exception:
            return self._send(400, {"ok": False, "stage": "body"})
        placa = str(body.get("placa", "")).strip().upper()
        renavam = str(body.get("renavam", "")).strip()
        uf = str(body.get("uf", "SP")).strip().upper()
        if not placa or not renavam:
            return self._send(400, {"ok": False, "stage": "params-faltando"})
        if not _consulta_lock.acquire(timeout=LOCK_WAIT_S):
            return self._send(429, {"ok": False, "stage": "ocupado"})
        try:
            _last_use[0] = time.time()
            res = consultar(placa, renavam, uf)
            _last_use[0] = time.time()
            return self._send(200, res)
        finally:
            _consulta_lock.release()

    def log_message(self, *_a):
        pass


def main():
    if not SECRET:
        log("AVISO: DETRAN_WORKER_SECRET vazio -> todas as requisicoes recebem 401")
    _carrega_sessao_do_disco()
    threading.Thread(target=idle_watch, daemon=True).start()
    srv = ThreadingHTTPServer((BIND_HOST, BIND_PORT), Handler)
    log("ouvindo em http://%s:%d (daemon=%s, profile=%s, motor=api+fallback-runner)" % (BIND_HOST, BIND_PORT, DAEMON, PROFILE))
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        srv.server_close()


if __name__ == "__main__":
    main()
