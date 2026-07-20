#!/usr/bin/env python3
"""
Adiciona o ad group "App Intent" na campanha Search IBV FIPE Placa
(24050523074): keywords com intencao explicita de aplicativo, RSA com
copy de app, e URL final /?app=1 (a homepage troca o contador pelo
badge do Play quando ve esse parametro).

Racional: search terms reais mostraram buscas como "aplicativo tabela
fipe pela placa" com CTR 50%. O {keyword} do ValueTrack insere a
keyword CASADA (nao o termo buscado), entao a rota do parametro exige
keywords dedicadas num grupo proprio.

Uso:
    ./pc-ads-add-app-intent-adgroup.py            # dry-run
    ./pc-ads-add-app-intent-adgroup.py --live     # cria de verdade
"""
import argparse
import sys
from pathlib import Path

from google.ads.googleads.client import GoogleAdsClient
from google.ads.googleads.errors import GoogleAdsException

CRED_PATH = str(Path.home() / ".google-ads-credentials.yaml")
CUSTOMER_ID = "8711328209"
CAMPAIGN_ID = 24050523074

FINAL_URL = "https://placacompleta.com.br/?app=1"

KEYWORDS_PHRASE = [
    "aplicativo tabela fipe pela placa",
    "aplicativo fipe pela placa",
    "app tabela fipe pela placa",
    "aplicativo para consultar fipe pela placa",
    "aplicativo consulta placa",
    "app consulta placa",
    "aplicativo para consultar placa",
]

HEADLINES = [
    "App de Consulta de Placa",        # pin pos 1
    "Baixe o App Grátis",
    "FIPE pela Placa no Celular",
    "Tabela FIPE no Aplicativo",
    "Resultado Direto na Tela",
    "Sem Cadastro, Sem Login",
    "Gráfico FIPE no seu Celular",
    "Instale Grátis Agora",            # pin pos 3 (CTA)
]
PINS = {0: 1, 7: 3}

DESCRIPTIONS = [
    "O app brasileiro gratuito de consulta de placa. Marca, modelo, ano e FIPE na tela.",
    "Digite a placa no app e veja o valor FIPE com gráfico de evolução. Sem login.",
    "Consulta veicular completa no celular. Resultado em segundos, 100% grátis.",
    "Disponível na Google Play. Placa antiga ou Mercosul, sem cadastro.",
]

AD_GROUP_ID = -1


def _pin_enum(client, position: int):
    e = client.enums.ServedAssetFieldTypeEnum
    return {1: e.HEADLINE_1, 2: e.HEADLINE_2, 3: e.HEADLINE_3}[position]


def build_operations(client):
    ops = []

    # 1. Ad Group
    op = client.get_type("MutateOperation")
    ag = op.ad_group_operation.create
    ag.resource_name = f"customers/{CUSTOMER_ID}/adGroups/{AD_GROUP_ID}"
    ag.name = "App Intent"
    ag.campaign = f"customers/{CUSTOMER_ID}/campaigns/{CAMPAIGN_ID}"
    ag.status = client.enums.AdGroupStatusEnum.ENABLED
    ag.type_ = client.enums.AdGroupTypeEnum.SEARCH_STANDARD
    ag.cpc_bid_micros = 500_000
    ops.append(op)

    # 2. Keywords
    for kw in KEYWORDS_PHRASE:
        op = client.get_type("MutateOperation")
        crit = op.ad_group_criterion_operation.create
        crit.ad_group = f"customers/{CUSTOMER_ID}/adGroups/{AD_GROUP_ID}"
        crit.status = client.enums.AdGroupCriterionStatusEnum.ENABLED
        crit.keyword.text = kw
        crit.keyword.match_type = client.enums.KeywordMatchTypeEnum.PHRASE
        ops.append(op)

    # 3. RSA
    op = client.get_type("MutateOperation")
    ad = op.ad_group_ad_operation.create
    ad.ad_group = f"customers/{CUSTOMER_ID}/adGroups/{AD_GROUP_ID}"
    ad.status = client.enums.AdGroupAdStatusEnum.ENABLED
    ad.ad.final_urls.append(FINAL_URL)
    for i, h in enumerate(HEADLINES):
        asset = client.get_type("AdTextAsset")
        asset.text = h
        if i in PINS:
            asset.pinned_field = _pin_enum(client, PINS[i])
        ad.ad.responsive_search_ad.headlines.append(asset)
    for d in DESCRIPTIONS:
        asset = client.get_type("AdTextAsset")
        asset.text = d
        ad.ad.responsive_search_ad.descriptions.append(asset)
    ad.ad.responsive_search_ad.path1 = "app"
    ad.ad.responsive_search_ad.path2 = "consulta-placa"
    ops.append(op)

    return ops


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--live", action="store_true", help="cria de verdade (default: dry-run)")
    args = parser.parse_args()

    validate_only = not args.live
    print(f"=== Modo: {'DRY-RUN' if validate_only else 'LIVE'} ===")
    print(f"Ad group:   App Intent (campanha {CAMPAIGN_ID})")
    print(f"URL final:  {FINAL_URL}")
    print(f"Keywords:   {len(KEYWORDS_PHRASE)} phrase-match")
    print(f"RSA:        {len(HEADLINES)} headlines + {len(DESCRIPTIONS)} descriptions")
    print()

    client = GoogleAdsClient.load_from_storage(CRED_PATH)
    svc = client.get_service("GoogleAdsService")
    ops = build_operations(client)
    print(f"Operacoes no batch: {len(ops)}")

    try:
        req = client.get_type("MutateGoogleAdsRequest")
        req.customer_id = CUSTOMER_ID
        req.mutate_operations.extend(ops)
        req.validate_only = validate_only
        resp = svc.mutate(request=req)
        print(f"\n✓ Batch {'validado' if validate_only else 'executado'} sem erros")
        if not validate_only:
            for result in resp.mutate_operation_responses:
                for field in ["ad_group_result", "ad_group_criterion_result", "ad_group_ad_result"]:
                    if result._pb.HasField(field):
                        print(f"  {getattr(result, field).resource_name}")
                        break
        print("\n=== " + ("DRY-RUN OK. Rode com --live apos o deploy do site." if validate_only
                          else "LIVE OK. Ad group App Intent ativo.") + " ===")
    except GoogleAdsException as e:
        print("\n❌ GoogleAdsException:")
        for err in e.failure.errors:
            print(f"  - {err.message}")
            if err.location:
                print("      em: " + " → ".join(f.field_name for f in err.location.field_path_elements))
        sys.exit(1)


if __name__ == "__main__":
    main()
