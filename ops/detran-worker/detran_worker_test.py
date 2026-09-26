# -*- coding: utf-8 -*-
# Teste (com mocks, SEM gov.br/browser) do backoff de extracao e da regra de
# fallback do consultar. Roda: python3 ops/detran-worker/detran_worker_test.py
import importlib.util, os, sys

def load_worker():
    p = os.path.join(os.path.dirname(os.path.abspath(__file__)), "detran-worker.py")
    spec = importlib.util.spec_from_file_location("detran_worker", p)
    m = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(m)
    return m

falhas = []
def check(nome, cond):
    print(("  OK  " if cond else " FAIL ") + nome)
    if not cond:
        falhas.append(nome)

def raises(exc):
    def _f(*a, **k):
        raise exc
    return _f

print("== backoff de extracao ==")
dw = load_worker()
dw._ultima_falha_extracao[0] = 1000.0
check("dentro do backoff (10s apos falha)", dw._dentro_do_backoff(agora=1010.0) is True)
check("fora do backoff (apos EXTRACT_BACKOFF_S)", dw._dentro_do_backoff(agora=1000.0 + dw.EXTRACT_BACKOFF_S + 1) is False)
dw._ultima_falha_extracao[0] = 0.0
check("nunca falhou -> nao esta em backoff", dw._dentro_do_backoff(agora=1000.0) is False)

# extrai_sessao em backoff NAO chama ensure_daemon (nao martela)
dw._ultima_falha_extracao[0] = 1_000_000_000_000.0  # "agora-ish", futuro proximo
chamou_daemon = {"v": False}
dw.ensure_daemon = lambda *a, **k: chamou_daemon.__setitem__("v", True) or True
import time as _t
dw._ultima_falha_extracao[0] = _t.time()  # falhou agora
r = dw.extrai_sessao()
check("extrai_sessao em backoff devolve None", r is None)
check("extrai_sessao em backoff NAO sobe daemon", chamou_daemon["v"] is False)

print("== consultar: fallback so com sessao valida ==")
dw = load_worker()
dw.get_sessao = lambda *a, **k: None  # login/daemon falhou
chamou = {"runner": False}
dw.fallback_runner = lambda *a, **k: (chamou.__setitem__("runner", True), {"ok": False})[1]
r = dw.consultar("ABC1D23", "123", "SP")
check("sem sessao -> stage sessao-indisponivel", r.get("stage") == "sessao-indisponivel")
check("sem sessao -> NAO cai no runner (nao dobra login)", chamou["runner"] is False)

print("== consultar: glitch de API com sessao valida -> runner ==")
dw = load_worker()
dw.get_sessao = lambda *a, **k: {"g_ck": "x", "cookie": "y"}
dw.detran_api.consultar_api = raises(RuntimeError("api 500"))
chamou = {"runner": False}
dw.fallback_runner = lambda *a, **k: (chamou.__setitem__("runner", True), {"ok": True, "fonte": "runner"})[1]
r = dw.consultar("ABC1D23", "123", "SP")
check("glitch de API com sessao -> cai no runner", chamou["runner"] is True and r.get("fonte") == "runner")

print("== consultar: sessao expirou e re-login falhou -> fail-open sem runner ==")
dw = load_worker()
seq = [{"g_ck": "x", "cookie": "y"}, None]  # 1a valida, re-extract falha
dw.get_sessao = lambda *a, **k: seq.pop(0) if seq else None
dw.detran_api.consultar_api = raises(dw.detran_api.SessaoExpirada("403"))
chamou = {"runner": False}
dw.fallback_runner = lambda *a, **k: (chamou.__setitem__("runner", True), {"ok": False})[1]
r = dw.consultar("ABC1D23", "123", "SP")
check("expirou + re-login falhou -> stage sessao-expirada-sem-relogin", r.get("stage") == "sessao-expirada-sem-relogin")
check("expirou + re-login falhou -> NAO cai no runner", chamou["runner"] is False)

print("\n%d falhas" % len(falhas))
sys.exit(1 if falhas else 0)
