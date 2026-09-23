#!/usr/bin/env python3
# -*- coding: utf-8 -*-
# ---------------------------------------------------------------------------
# detran-worker: ponte HTTP INTERNA entre o container Nuxt e o runner DETRAN-SP.
#
# O container Nuxt nao roda o browser-harness (ferramenta do HOST). Entao a
# consulta de multas passa por este worker, que roda no host como root:
#   POST /consultar {placa, renavam, uf?} + header X-Worker-Secret
#     -> garante o daemon cloud `pcdetran` vivo (start-on-demand)
#     -> roda `BU_NAME=pcdetran browser-harness < /root/detran-sp-runner.py`
#     -> parseia o bloco <<<JSON>>> ... <<<END>>> e devolve como JSON.
#
# Seguranca: dados de multa por placa+renavam sao PII. O worker NUNCA escuta em
# 0.0.0.0 (exporia na eth0 publica). Bind EXPLICITO no gateway do bridge coolify
# (10.0.1.1), inalcancavel de fora da VPS, + segredo no header (compara constant-time).
#
# Concorrencia = 1: o daemon usa UM profile gov.br persistente compartilhado;
# duas consultas simultaneas se atropelam e podem deslogar/corromper a sessao.
# Um lock global serializa; excedente recebe 429 (o Nuxt trata como fail-open).
#
# Lifecycle do daemon: start-on-demand + stop apos ociosidade (billing por tempo,
# volume baixo). Cold start (~15-60s + auto-login se a sessao expirou) na 1a
# consulta da janela; o runner e auto-curavel no login.
# ---------------------------------------------------------------------------
import hmac
import json
import os
import subprocess
import sys
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

BIND_HOST = os.environ.get("DETRAN_WORKER_HOST", "10.0.1.1")  # gateway bridge coolify; NUNCA 0.0.0.0
BIND_PORT = int(os.environ.get("DETRAN_WORKER_PORT", "8477"))
SECRET = os.environ.get("DETRAN_WORKER_SECRET", "")
DAEMON = os.environ.get("DETRAN_DAEMON", "pcdetran")
PROFILE = os.environ.get("DETRAN_PROFILE", "gov-br")
RUNNER = os.environ.get("DETRAN_RUNNER", "/root/detran-sp-runner.py")
HARNESS = os.environ.get("BROWSER_HARNESS_BIN", os.path.expanduser("~/.local/bin/browser-harness"))
LOCAL_BIN = os.path.dirname(HARNESS) or os.path.expanduser("~/.local/bin")
IDLE_STOP_S = int(os.environ.get("DETRAN_IDLE_STOP_S", "600"))   # 10 min ocioso -> para o daemon
RUN_TIMEOUT_S = int(os.environ.get("DETRAN_RUN_TIMEOUT_S", "220"))  # warm ~66-85s; cold+relogin pode passar de 150s
START_TIMEOUT_S = int(os.environ.get("DETRAN_START_TIMEOUT_S", "120"))
LOCK_WAIT_S = int(os.environ.get("DETRAN_LOCK_WAIT_S", "8"))     # espera curta pelo lock; senao 429

_consulta_lock = threading.Lock()   # concorrencia = 1 nas consultas
_daemon_lock = threading.Lock()     # protege start/stop do daemon
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
    """Roda um script Python pelo harness (heredoc via stdin)."""
    return subprocess.run(
        [HARNESS], input=script, capture_output=True, text=True,
        timeout=timeout, env=_env(extra_env),
    )


def daemon_alive():
    """True se o daemon `pcdetran` ja esta vivo (sem tentar subir Chrome local)."""
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
        # IMPORTANTE: o heredoc TEM que comecar com start_remote_daemon( senao o
        # harness tenta um Chrome local (inexistente no host) e falha.
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
    """Para o daemon apos IDLE_STOP_S sem consulta, pra nao pagar tempo a toa."""
    while True:
        time.sleep(30)
        if _last_use[0] and (time.time() - _last_use[0]) > IDLE_STOP_S:
            # nao para no meio de uma consulta
            if _consulta_lock.acquire(blocking=False):
                try:
                    stop_daemon()
                    _last_use[0] = 0.0
                finally:
                    _consulta_lock.release()


def consultar(placa, renavam, uf):
    """Garante o daemon, roda o runner e devolve o JSON dele (ou um erro estruturado)."""
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
    out = r.stdout or ""
    i = out.find("<<<JSON>>>")
    j = out.find("<<<END>>>", i) if i >= 0 else -1
    if i < 0 or j < 0:
        return {"ok": False, "stage": "sem-json-do-runner", "amostra": out[-400:]}
    blob = out[i + len("<<<JSON>>>"):j].strip()
    try:
        return json.loads(blob)
    except Exception as e:
        return {"ok": False, "stage": "json-invalido", "erro": repr(e)[:120], "amostra": blob[:300]}


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
            return self._send(200, {"ok": True, "daemon_alive": daemon_alive()})
        return self._send(404, {"ok": False, "stage": "rota"})

    def do_POST(self):
        # /warm: sobe o daemon (start-on-demand) sem rodar consulta. Serve pro
        # pre-warm agendado (timer systemd antes do pico de vendas), pra a 1a
        # consulta do cliente nao pagar o cold-start. Auth como o /consultar.
        if self.path.rstrip("/") == "/warm":
            if not self._autorizado():
                return self._send(401, {"ok": False, "stage": "auth"})
            if not _consulta_lock.acquire(timeout=LOCK_WAIT_S):
                return self._send(429, {"ok": False, "stage": "ocupado"})
            try:
                alive = ensure_daemon()
                _last_use[0] = time.time()  # reinicia o relogio de ociosidade
                return self._send(200, {"ok": bool(alive), "daemon_alive": alive, "warm": True})
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
        # concorrencia = 1: espera curta pelo lock; se ocupado, 429 (Nuxt fail-open)
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
        pass  # silencia o access-log default (barulhento)


def main():
    if not SECRET:
        log("AVISO: DETRAN_WORKER_SECRET vazio -> todas as requisicoes recebem 401")
    threading.Thread(target=idle_watch, daemon=True).start()
    srv = ThreadingHTTPServer((BIND_HOST, BIND_PORT), Handler)
    log("ouvindo em http://%s:%d (daemon=%s, profile=%s)" % (BIND_HOST, BIND_PORT, DAEMON, PROFILE))
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        srv.server_close()


if __name__ == "__main__":
    main()
