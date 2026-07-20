#!/usr/bin/env python3
"""
Cria a primeira campanha Search do PlacaCompleta via Google Ads API.

Estrutura (rev 2, com melhorias do playbook google-ads-manager):
- Campanha "IBV FIPE Placa - Test #XXX", orcamento R$10/dia (R$300/mes)
- Geo Brasil, idioma PT
- Bidding: MAXIMIZE_CLICKS via TargetSpend (conta nova sem conversions)
- 1 ad group com 6 keywords phrase-match focadas em FIPE
- 3 RSAs com angulos diferentes (gratis / velocidade / confianca)
- Pin strategy nas headlines: pos 1 = keyword, pos 3 = CTA
- Mobile bid adjustment +20%
- Search Partners desligado
- Negatives no nivel da campanha para evitar clique irrelevante

Uso:
    ./pc-ads-create-campaign.py            # dry-run
    ./pc-ads-create-campaign.py --live     # cria de verdade (status PAUSED)
"""
import argparse
import sys
import uuid
from pathlib import Path

from google.ads.googleads.client import GoogleAdsClient
from google.ads.googleads.errors import GoogleAdsException

CRED_PATH = str(Path.home() / ".google-ads-credentials.yaml")
CUSTOMER_ID = "8711328209"

CAMPAIGN_NAME = f"IBV FIPE Placa - Test #{uuid.uuid4().hex[:6]}"
DAILY_BUDGET_MICROS = 10_000_000  # R$10/dia
FINAL_URL = "https://placacompleta.com.br/tabela-fipe-por-placa"

KEYWORDS_PHRASE = [
    "tabela fipe pela placa",
    "fipe pela placa",
    "consultar tabela fipe pela placa",
    "valor fipe pela placa",
    "consulta fipe pela placa",
    "tabela fipe placa",
]

# Negativos: evitar torrar orcamento em buscas que nao convertem
NEGATIVE_KEYWORDS = [
    "renavam",         # nao oferecemos
    "leilao", "leilão",
    "roubada", "roubado",
    "clonada", "clonado",
    "aluguel", "aluga",
    "compensado",       # placa como material construcao
    "sinalizacao", "sinalização",  # placa de transito
    "restaurante",      # placa decorativa
    "gestante", "idoso",  # placa de estacionamento reservado
]

# 3 RSAs. Cada um tem 8 headlines + 4 descriptions. Formato: (list_headlines, list_descriptions, [pins])
# pins: dict {0: 1} significa headline indice 0 pinada em posicao 1

# Ad 1 — angulo "gratis / sem cadastro" (o mais generico)
AD_1_HEADLINES = [
    "Tabela FIPE pela Placa Grátis",       # pin position 1
    "Consulte FIPE pela Placa",
    "Valor FIPE do Carro Direto",
    "Consulta Placa Grátis Online",
    "Tabela FIPE de Qualquer Carro",
    "FIPE do Seu Carro em 10s",
    "Sem Cadastro, Sem Login",
    "Consulta Grátis Agora",               # pin position 3 (CTA)
]
AD_1_PINS = {0: 1, 7: 3}  # headline 0 pinado em pos 1, headline 7 pinado em pos 3
AD_1_DESCRIPTIONS = [
    "Digite a placa, veja o valor FIPE atualizado do carro. Grátis, sem cadastro.",
    "Consulta veicular grátis: marca, modelo, ano, FIPE. Resultado em segundos.",
    "FIPE, marca, modelo, ano e situação. Tudo pela placa, sem custo, sem login.",
    "Ferramenta brasileira grátis para consultar valor FIPE de qualquer veículo.",
]

# Ad 2 — angulo "velocidade"
AD_2_HEADLINES = [
    "Consulta FIPE em Segundos",           # pin position 1
    "Placa: FIPE em 10 Segundos",
    "Valor FIPE Rápido e Grátis",
    "FIPE Instantânea pela Placa",
    "Consulta Rápida por Placa",
    "Descubra a FIPE Agora",
    "FIPE em Tempo Real",
    "Consultar Placa Agora",               # pin position 3 (CTA)
]
AD_2_PINS = {0: 1, 7: 3}
AD_2_DESCRIPTIONS = [
    "Consulta veicular direto na tela. Digite a placa e receba FIPE em segundos.",
    "Placa: dados completos em um clique. Sem cadastro, sem espera.",
    "Ferramenta 100% gratuita. Consulta em tempo real, resultado imediato.",
    "Descubra tudo sobre o carro só com a placa. Grátis, rápido, seguro.",
]

# Ad 3 — angulo "confianca / completude"
AD_3_HEADLINES = [
    "Consulta Veicular Completa",          # pin position 1
    "Dados Completos pela Placa",
    "FIPE, Marca, Modelo, Ano",
    "Tudo Sobre o Veículo Grátis",
    "Com Base na Tabela FIPE",
    "Consulta Confiável e Segura",
    "Dados Reais do Veículo",
    "Ver Dados do Carro Agora",            # pin position 3 (CTA)
]
AD_3_PINS = {0: 1, 7: 3}
AD_3_DESCRIPTIONS = [
    "Marca, modelo, ano, FIPE, situação. Tudo pela placa, sem cadastro.",
    "Ferramenta brasileira gratuita com dados oficiais FIPE. Sem custo, sem login.",
    "Consulta veicular completa. Dados públicos oficiais, direto na tela.",
    "Digite a placa e receba as informações verificadas do veículo.",
]

ALL_ADS = [
    (AD_1_HEADLINES, AD_1_DESCRIPTIONS, AD_1_PINS),
    (AD_2_HEADLINES, AD_2_DESCRIPTIONS, AD_2_PINS),
    (AD_3_HEADLINES, AD_3_DESCRIPTIONS, AD_3_PINS),
]

PATH_1 = "tabela-fipe"
PATH_2 = "pela-placa"

GEO_BRASIL = 2076
LANG_PT = 1014

# Temp IDs para cross-reference dentro do mesmo batch
BUDGET_ID = -1
CAMPAIGN_ID = -2
AD_GROUP_ID = -3

# Device criteria enum values (from Google Ads API)
# MOBILE = 30001 nope, use enum
# Bid modifier: 1.0 = no change, 1.2 = +20%
MOBILE_BID_MODIFIER = 1.20


def _pin_enum(client, position: int):
    """Retorna ServedAssetFieldTypeEnum para position 1, 2 ou 3."""
    e = client.enums.ServedAssetFieldTypeEnum
    return {1: e.HEADLINE_1, 2: e.HEADLINE_2, 3: e.HEADLINE_3}[position]


def build_operations(client):
    ops = []

    # 1. Budget
    op = client.get_type("MutateOperation")
    b = op.campaign_budget_operation.create
    b.resource_name = f"customers/{CUSTOMER_ID}/campaignBudgets/{BUDGET_ID}"
    b.name = f"Budget {CAMPAIGN_NAME}"
    b.delivery_method = client.enums.BudgetDeliveryMethodEnum.STANDARD
    b.amount_micros = DAILY_BUDGET_MICROS
    b.explicitly_shared = False
    ops.append(op)

    # 2. Campaign
    op = client.get_type("MutateOperation")
    c = op.campaign_operation.create
    c.resource_name = f"customers/{CUSTOMER_ID}/campaigns/{CAMPAIGN_ID}"
    c.name = CAMPAIGN_NAME
    c.advertising_channel_type = client.enums.AdvertisingChannelTypeEnum.SEARCH
    c.status = client.enums.CampaignStatusEnum.PAUSED
    c.contains_eu_political_advertising = client.enums.EuPoliticalAdvertisingStatusEnum.DOES_NOT_CONTAIN_EU_POLITICAL_ADVERTISING
    c.target_spend._pb.SetInParent()
    c.campaign_budget = f"customers/{CUSTOMER_ID}/campaignBudgets/{BUDGET_ID}"
    import datetime as _dt
    # v24 renomeou start_date/end_date para *_date_time
    c.end_date_time = (_dt.date.today() + _dt.timedelta(days=30)).strftime("%Y-%m-%d 23:59:59")
    # Network: SO Google Search (SEM Search Partners, sem Display)
    c.network_settings.target_google_search = True
    c.network_settings.target_search_network = False   # Search Partners OFF (playbook)
    c.network_settings.target_content_network = False
    ops.append(op)

    # 3. Ad Group
    op = client.get_type("MutateOperation")
    ag = op.ad_group_operation.create
    ag.resource_name = f"customers/{CUSTOMER_ID}/adGroups/{AD_GROUP_ID}"
    ag.name = "FIPE pela Placa"
    ag.campaign = f"customers/{CUSTOMER_ID}/campaigns/{CAMPAIGN_ID}"
    ag.status = client.enums.AdGroupStatusEnum.ENABLED
    ag.type_ = client.enums.AdGroupTypeEnum.SEARCH_STANDARD
    ag.cpc_bid_micros = 500_000
    ops.append(op)

    # 4. Keywords (phrase match) — positivas
    for kw in KEYWORDS_PHRASE:
        op = client.get_type("MutateOperation")
        crit = op.ad_group_criterion_operation.create
        crit.ad_group = f"customers/{CUSTOMER_ID}/adGroups/{AD_GROUP_ID}"
        crit.status = client.enums.AdGroupCriterionStatusEnum.ENABLED
        crit.keyword.text = kw
        crit.keyword.match_type = client.enums.KeywordMatchTypeEnum.PHRASE
        ops.append(op)

    # 5. Negative keywords — campaign level
    for neg in NEGATIVE_KEYWORDS:
        op = client.get_type("MutateOperation")
        cc = op.campaign_criterion_operation.create
        cc.campaign = f"customers/{CUSTOMER_ID}/campaigns/{CAMPAIGN_ID}"
        cc.negative = True
        cc.keyword.text = neg
        cc.keyword.match_type = client.enums.KeywordMatchTypeEnum.BROAD  # broad match para pegar variantes
        ops.append(op)

    # 6. RSAs (3 anúncios)
    for headlines, descriptions, pins in ALL_ADS:
        op = client.get_type("MutateOperation")
        ad = op.ad_group_ad_operation.create
        ad.ad_group = f"customers/{CUSTOMER_ID}/adGroups/{AD_GROUP_ID}"
        ad.status = client.enums.AdGroupAdStatusEnum.ENABLED
        ad.ad.final_urls.append(FINAL_URL)
        for i, h in enumerate(headlines):
            asset = client.get_type("AdTextAsset")
            asset.text = h
            if i in pins:
                asset.pinned_field = _pin_enum(client, pins[i])
            ad.ad.responsive_search_ad.headlines.append(asset)
        for d in descriptions:
            asset = client.get_type("AdTextAsset")
            asset.text = d
            ad.ad.responsive_search_ad.descriptions.append(asset)
        ad.ad.responsive_search_ad.path1 = PATH_1
        ad.ad.responsive_search_ad.path2 = PATH_2
        ops.append(op)

    # 7. Geo Brasil
    op = client.get_type("MutateOperation")
    cc = op.campaign_criterion_operation.create
    cc.campaign = f"customers/{CUSTOMER_ID}/campaigns/{CAMPAIGN_ID}"
    cc.location.geo_target_constant = f"geoTargetConstants/{GEO_BRASIL}"
    ops.append(op)

    # 8. Idioma PT
    op = client.get_type("MutateOperation")
    cc = op.campaign_criterion_operation.create
    cc.campaign = f"customers/{CUSTOMER_ID}/campaigns/{CAMPAIGN_ID}"
    cc.language.language_constant = f"languageConstants/{LANG_PT}"
    ops.append(op)

    # 9. Mobile bid modifier +20%
    op = client.get_type("MutateOperation")
    cc = op.campaign_criterion_operation.create
    cc.campaign = f"customers/{CUSTOMER_ID}/campaigns/{CAMPAIGN_ID}"
    cc.device.type_ = client.enums.DeviceEnum.MOBILE
    cc.bid_modifier = MOBILE_BID_MODIFIER
    ops.append(op)

    return ops


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--live", action="store_true", help="cria de verdade (default: dry-run)")
    args = parser.parse_args()

    validate_only = not args.live
    mode = "DRY-RUN" if validate_only else "LIVE"
    print(f"=== Modo: {mode} ===")
    print(f"Nome:       {CAMPAIGN_NAME}")
    print(f"Orçamento:  R${DAILY_BUDGET_MICROS/1_000_000:.2f}/dia (R${DAILY_BUDGET_MICROS/1_000_000*30:.0f}/mês)")
    print(f"Landing:    {FINAL_URL}")
    print(f"Keywords:   {len(KEYWORDS_PHRASE)} phrase-match + {len(NEGATIVE_KEYWORDS)} negativas")
    print(f"Ad copy:    {len(ALL_ADS)} RSAs (cada um: 8 titles + 4 descriptions)")
    print(f"Pin:        headline #1 fixado em pos 1, CTA em pos 3 (por RSA)")
    print(f"Geo:        Brasil ({GEO_BRASIL})")
    print(f"Bidding:    Maximize Clicks (TargetSpend)")
    print(f"Rede:       Google Search apenas (Search Partners OFF)")
    print(f"Mobile:     bid modifier +20%")
    print()

    client = GoogleAdsClient.load_from_storage(CRED_PATH)
    svc = client.get_service("GoogleAdsService")

    ops = build_operations(client)
    print(f"Total de operacoes no batch: {len(ops)}")

    try:
        req = client.get_type("MutateGoogleAdsRequest")
        req.customer_id = CUSTOMER_ID
        req.mutate_operations.extend(ops)
        req.validate_only = validate_only

        resp = svc.mutate(request=req)
        print(f"\n✓ Batch {'validado' if validate_only else 'executado'} sem erros")
        if not validate_only:
            counts = {}
            for result in resp.mutate_operation_responses:
                for field in ["campaign_budget_result", "campaign_result", "ad_group_result",
                              "ad_group_criterion_result", "ad_group_ad_result",
                              "campaign_criterion_result"]:
                    if result._pb.HasField(field):
                        counts[field] = counts.get(field, 0) + 1
                        break
            print("\nRecursos criados:")
            for f, n in counts.items():
                print(f"  {f}: {n}")

        print()
        if validate_only:
            print("=== DRY-RUN OK. Rode novamente com --live para criar de verdade. ===")
        else:
            print("=== LIVE OK — campanha criada em PAUSED. ===")
            print("Ative manualmente na UI: ads.google.com → Campanhas → [nome] → Ativar")

    except GoogleAdsException as e:
        print(f"\n❌ GoogleAdsException:")
        for err in e.failure.errors:
            print(f"  - {err.message}")
            if err.location:
                path_str = " → ".join(f.field_name for f in err.location.field_path_elements)
                print(f"      em: {path_str}")
        sys.exit(1)


if __name__ == "__main__":
    main()
