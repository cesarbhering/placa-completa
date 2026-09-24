# -*- coding: utf-8 -*-
# ---------------------------------------------------------------------------
# detran_api: consulta DIRETA da API interna do DETRAN-SP (ServiceNow), sem
# navegar a SPA. Recebe uma SESSAO ja extraida ({cookie, g_ck, ua}) e faz os 4
# GETs autenticados, parseando o resultado no MESMO contrato que o runner de
# navegacao devolvia (o Nuxt mapeia igual, via mapearRespostaRunner).
#
# Caminho B (provado no POC /root/detran-poc): a sessao (cookies httpOnly + o
# X-UserToken=g_ck) e extraida uma vez pelo browser e reusada em HTTP puro da
# VPS (nao amarra IP). TTL ~30min -> o worker re-extrai a cada 25min.
#
# LGPD: o endpoint base traz nomeProprietario + idProprietario (nome + CPF/CNPJ
# do dono). ISTO NUNCA E LIDO NEM PERSISTIDO -- so os campos tecnicos do veiculo.
# ---------------------------------------------------------------------------
import json
import re
import urllib.request
import urllib.error

HOST = "https://www.detran.sp.gov.br"
API_BASE_FMT = "/api/x_mdpdd_deb_restr/v1/consulta_debitos_restricoes/veiculos/%s/placa/%s"
REFERER = HOST + "/detransp/pb/servicos/veiculos/consultar_debitos_restricoes?id=consultar_debitos_restricoes"
# Campos do base que NUNCA saem daqui (PII do proprietario). Guard de LGPD.
PII_PROIBIDO = ("nomeProprietario", "idProprietario")


def _centavos(valor):
    """float reais -> int centavos. None/invalido -> None."""
    if valor is None:
        return None
    try:
        return int(round(float(valor) * 100))
    except (TypeError, ValueError):
        return None


def _iso_para_br(d):
    """'2026-09-30' -> '30/09/2026'. Ja em DD/MM/AAAA passa direto. Senao None."""
    if not d or not isinstance(d, str):
        return None
    m = re.match(r"^(\d{4})-(\d{2})-(\d{2})", d)
    if m:
        return "%s/%s/%s" % (m.group(3), m.group(2), m.group(1))
    if re.match(r"^\d{2}/\d{2}/\d{4}$", d):
        return d
    return None


def _km_int(valor):
    """'125599 km' / '125.599 km' -> 125599. Sem digitos -> None."""
    if valor is None:
        return None
    dig = re.sub(r"\D", "", str(valor))
    return int(dig) if dig else None


def parse_hodometro(vistorias):
    """As vistorias vem como pares alternados {label:'Data realização',valor:'DD/MM/AAAA'}
    e {label:'km',valor:'NNN km'}. Casa cada km com a data imediatamente anterior."""
    leituras = []
    data_atual = None
    for item in vistorias or []:
        if not isinstance(item, dict):
            continue
        label = str(item.get("label", "")).strip().lower()
        valor = item.get("valor")
        if "data" in label:
            v = str(valor or "").strip()
            data_atual = v if re.match(r"^\d{2}/\d{2}/\d{4}$", v) else None
        elif label == "km" or "km" in label:
            km = _km_int(valor)
            if data_atual and km is not None:
                leituras.append({"data": data_atual, "km": km})
    return leituras


def _suspeito(hodometro):
    """Ordena cronologico e ve se a km cai (adulteracao)."""
    def chave(h):
        try:
            dd, mm, yy = h["data"].split("/")
            return (int(yy), int(mm), int(dd))
        except Exception:
            return (0, 0, 0)
    chrono = sorted(hodometro, key=chave)
    kms = [h["km"] for h in chrono]
    return any(kms[i] > kms[i + 1] for i in range(len(kms) - 1)) if len(kms) > 1 else False


def _soma_valores(data):
    """Soma attributes.valor de uma lista data[] (debitos-milt). Vazio -> 0."""
    total = 0.0
    achou = False
    for row in data or []:
        attrs = (row or {}).get("attributes") or {}
        v = attrs.get("valor")
        if v is not None:
            try:
                total += float(v)
                achou = True
            except (TypeError, ValueError):
                pass
    return total if achou else 0.0


def _veiculo_do_base(attrs):
    """So campos tecnicos. NUNCA copia PII do proprietario (LGPD)."""
    def desc(k):
        o = attrs.get(k)
        return o.get("descricao") if isinstance(o, dict) else None
    veic = {
        "marca_modelo": desc("marcaModelo"),
        "cor": desc("cor"),
        "tipo": desc("tipo"),
        "combustivel": desc("combustivel"),
        "especie": desc("especie"),
        "ano_fab": attrs.get("anoFabricacao"),
        "ano_modelo": attrs.get("anoModelo"),
        "chassi": attrs.get("chassi"),
    }
    return {k: v for k, v in veic.items() if v not in (None, "")}


def parse_api(base, milt, ipva, lic, placa, renavam):
    """Junta os 4 JSON da API no contrato que o Nuxt espera (igual ao runner).
    `base/milt/ipva/lic` sao os dicts ja desserializados (ou None se a chamada
    nao trouxe corpo util)."""
    attrs = (((base or {}).get("data") or {}) or {}).get("attributes") or {}
    # guard duro de LGPD: se por engano algum PII vier junto, remove antes de usar
    for k in PII_PROIBIDO:
        attrs.pop(k, None)

    hodometro = parse_hodometro(attrs.get("vistorias"))

    multas_c = _centavos(_soma_valores((milt or {}).get("data")))
    ipva_meta = ((ipva or {}).get("meta") or {}).get("valor")
    ipva_c = _centavos(ipva_meta if ipva_meta is not None else _soma_valores((ipva or {}).get("data")))

    lic_data = (lic or {}).get("data") or []
    lic_c = None
    lic_venc = None
    if lic_data:
        la = (lic_data[0] or {}).get("attributes") or {}
        lic_c = _centavos(la.get("valor"))
        lic_venc = _iso_para_br(la.get("dataVencimento"))

    tot = sum(x for x in (multas_c, ipva_c, lic_c) if x)
    status = "com_debito" if tot and tot > 0 else "sem_debito"

    return {
        "ok": True,
        "encontrado": True,
        "placa": placa,
        "renavam": renavam,
        "uf": "SP",
        "status": status,
        "multas_total_centavos": multas_c,
        "ipva_total_centavos": ipva_c,
        "licenciamento_centavos": lic_c,
        "licenciamento_venc": lic_venc,
        "hodometro": hodometro,
        "hodometro_suspeito": _suspeito(hodometro),
        "veiculo": _veiculo_do_base(attrs),
        "fonte": "api",
    }


# ---- HTTP puro (caminho B) -------------------------------------------------

class SessaoExpirada(Exception):
    pass


def api_get(session, path, timeout=30):
    """GET autenticado na API interna. Devolve (status, dict|None). 401/403
    levantam SessaoExpirada pra o chamador re-extrair a sessao."""
    url = HOST + path
    req = urllib.request.Request(url, method="GET")
    req.add_header("Accept", "application/json")
    req.add_header("X-UserToken", session["g_ck"])
    req.add_header("X-Use-Polaris", "false")
    req.add_header("Referer", REFERER)
    req.add_header("Cookie", session["cookie"])
    if session.get("ua"):
        req.add_header("User-Agent", session["ua"])
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            raw = r.read().decode("utf-8", "ignore")
            status = r.status
    except urllib.error.HTTPError as e:
        status = e.code
        raw = e.read().decode("utf-8", "ignore") if e.fp else ""
        if status in (401, 403):
            raise SessaoExpirada("http %d" % status)
    try:
        return status, json.loads(raw)
    except Exception:
        return status, None


def consultar_api(session, placa, renavam, timeout=30):
    """Faz os 4 GETs e parseia. Levanta SessaoExpirada se a sessao caiu.
    404 no base = veiculo nao encontrado."""
    base_path = API_BASE_FMT % (renavam, placa)
    st_base, base = api_get(session, base_path, timeout)
    if st_base == 404 or not base or not (base.get("data")):
        return {"ok": True, "encontrado": False, "placa": placa, "renavam": renavam, "uf": "SP", "fonte": "api"}
    _, milt = api_get(session, base_path + "/debitos-milt", timeout)
    _, ipva = api_get(session, base_path + "/debitos-ipva", timeout)
    _, lic = api_get(session, base_path + "/debitos-licenciamento", timeout)
    return parse_api(base, milt, ipva, lic, placa, renavam)
