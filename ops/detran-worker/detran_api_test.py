# -*- coding: utf-8 -*-
# Teste do parser da API DETRAN-SP. Roda: python3 ops/detran-worker/detran_api_test.py
# Fixtures fieis ao /root/detran-poc/exemplo-respostas-api.txt (FHB6G05 real).
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from detran_api import parse_api, parse_hodometro, _centavos, _iso_para_br, _km_int, PII_PROIBIDO

falhas = []
def check(nome, cond):
    print(("  OK  " if cond else " FAIL ") + nome)
    if not cond:
        falhas.append(nome)

# --- fixtures reais (FHB6G05) ---
BASE_FHB = {"data": {"type": "veiculos", "id": "00996754997", "attributes": {
    "placa": "FHB6G05", "idProprietario": "20473035000155", "nomeProprietario": "ALEX SANDRO A GRIGOLETI",
    "chassi": "93YHSR2LAEJ221332", "renavam": "00996754997", "codigoMunicipio": 6549, "nomeMunicipio": "ITAPEVA",
    "marcaModelo": {"codigo": 221342, "descricao": "RENAULT/DUSTER 20 D 4X2A"},
    "tipo": {"codigo": 13, "descricao": "CAMIONETA"}, "cor": {"codigo": 4, "descricao": "BRANCA"},
    "combustivel": {"codigo": 16, "descricao": "ALCOOL/GASOLINA"}, "especie": {"codigo": 3, "descricao": "MISTO"},
    "anoFabricacao": 2013, "anoModelo": 2014,
    "vistorias": [
        {"valor": "16/09/2020", "label": "Data realização"}, {"valor": "125599 km", "label": "km"},
        {"valor": "22/01/2020", "label": "Data realização"}, {"valor": "115813 km", "label": "km"},
        {"valor": "14/12/2019", "label": "Data realização"}, {"valor": "114671 km", "label": "km"},
        {"valor": "29/06/2017", "label": "Data realização"}, {"valor": "76999 km", "label": "km"},
    ]}}}
MILT_FHB = {"data": [{"type": "debitos-milt", "attributes": {"autoInfracao": "1DI9502151", "dataInfracao": "2025-10-09",
    "dataVencimento": "2026-01-19", "valor": 141.61, "descricao": "CONDUZIR VEIC.C/ DEFEITO", "municipio": "ITAPEVA"}}],
    "meta": {"qtde": 1, "valor": 141.61}}
IPVA_VAZIO = {"data": [], "meta": {"qtde": 0, "valor": 0.0}}
LIC_FHB = {"data": [{"type": "debitos-licenciamento", "attributes": {"exercicio": 2026, "dataVencimento": "2026-09-30", "valor": 174.08}}],
    "meta": {"qtde": 1, "valor": 174.08}}

print("== FHB6G05 (com debito) ==")
out = parse_api(BASE_FHB, MILT_FHB, IPVA_VAZIO, LIC_FHB, "FHB6G05", "00996754997")
check("status com_debito", out["status"] == "com_debito")
check("multas R$141,61 -> 14161", out["multas_total_centavos"] == 14161)
check("ipva 0", out["ipva_total_centavos"] == 0)
check("licenciamento R$174,08 -> 17408", out["licenciamento_centavos"] == 17408)
check("venc 2026-09-30 -> 30/09/2026", out["licenciamento_venc"] == "30/09/2026")
check("hodometro 4 leituras", len(out["hodometro"]) == 4)
check("hodometro 1a leitura", out["hodometro"][0] == {"data": "16/09/2020", "km": 125599})
check("hodometro nao suspeito (km sobe no tempo)", out["hodometro_suspeito"] is False)
check("veiculo marca_modelo", out["veiculo"].get("marca_modelo") == "RENAULT/DUSTER 20 D 4X2A")
check("veiculo combustivel", out["veiculo"].get("combustivel") == "ALCOOL/GASOLINA")
check("ok/encontrado/uf", out["ok"] and out["encontrado"] and out["uf"] == "SP")

# LGPD: nenhum PII do proprietario pode aparecer em lugar nenhum da saida
blob = json.dumps(out, ensure_ascii=False)
check("LGPD: sem nomeProprietario no output", "GRIGOLETI" not in blob and "nomeProprietario" not in blob)
check("LGPD: sem idProprietario (CPF/CNPJ) no output", "20473035000155" not in blob and "idProprietario" not in blob)

print("== FSP4A20 (sem debito) ==")
BASE_SD = {"data": {"attributes": {"marcaModelo": {"descricao": "FIAT/UNO"}, "anoModelo": 2015, "vistorias": []}}}
out2 = parse_api(BASE_SD, {"data": []}, IPVA_VAZIO, {"data": []}, "FSP4A20", "01008925400")
check("status sem_debito", out2["status"] == "sem_debito")
check("multas 0", out2["multas_total_centavos"] == 0)
check("licenciamento None (sem data)", out2["licenciamento_centavos"] is None)
check("hodometro vazio", out2["hodometro"] == [])

print("== hodometro suspeito (km cai) ==")
susp = parse_hodometro([
    {"valor": "01/01/2020", "label": "Data realização"}, {"valor": "90000 km", "label": "km"},
    {"valor": "01/01/2022", "label": "Data realização"}, {"valor": "50000 km", "label": "km"},
])
from detran_api import _suspeito
check("suspeito detecta km pra tras", _suspeito(susp) is True)

print("== helpers ==")
check("_centavos 141.61", _centavos(141.61) == 14161)
check("_centavos None", _centavos(None) is None)
check("_iso_para_br ISO", _iso_para_br("2026-09-30") == "30/09/2026")
check("_iso_para_br ja BR", _iso_para_br("30/09/2026") == "30/09/2026")
check("_km_int com ponto", _km_int("125.599 km") == 125599)

# base 404/vazio -> encontrado False (via consultar_api, mas parse_api assume base valido)
print("\n%d falhas" % len(falhas))
sys.exit(1 if falhas else 0)
