#!/usr/bin/env python3
"""
Cria a campanha de promocao do app Android PlacaCompleta (App Campaign).

App Campaigns sao automatizadas pelo Google: sem keywords manuais, os
assets de texto sao combinados e veiculados em Play Store, Search,
YouTube e Display. A gente controla orcamento, geo, idioma e assets.

Estrutura:
- Campanha "App Install PlacaCompleta - Test #XXX"
- Orcamento R$2,67/dia (~R$80/30d), termina em +30 dias
- App: br.com.placacompleta (Google Play)
- Bidding: maximizar instalacoes sem custo-alvo (conta sem historico)
- Geo Brasil, idioma PT
- Assets: 5 headlines + 4 descriptions

Uso:
    ./pc-ads-create-app-campaign.py            # dry-run
    ./pc-ads-create-app-campaign.py --live     # cria de verdade (PAUSED)
"""
import argparse
import datetime
import sys
import uuid
from pathlib import Path

from google.ads.googleads.client import GoogleAdsClient
from google.ads.googleads.errors import GoogleAdsException

CRED_PATH = str(Path.home() / ".google-ads-credentials.yaml")
CUSTOMER_ID = "8711328209"

CAMPAIGN_NAME = f"App Install PlacaCompleta - Test #{uuid.uuid4().hex[:6]}"
DAILY_BUDGET_MICROS = 2_670_000  # R$2,67/dia ≈ R$80/mes
APP_ID = "br.com.placacompleta"

HEADLINES = [
    "Consulta de Placa Grátis",
    "FIPE e Dados pela Placa",
    "Descubra Tudo do Veículo",
    "Placa Antiga ou Mercosul",
    "Sem Cadastro, Direto na Tela",
]

DESCRIPTIONS = [
    "Digite a placa e veja marca, modelo, ano, FIPE e situação. Grátis.",
    "Consulta veicular completa no seu celular. Sem login, sem custo.",
    "Valor FIPE atualizado e histórico de preço de qualquer veículo.",
    "O app brasileiro gratuito de consulta de placa. Resultado em segundos.",
]

GEO_BRASIL = 2076
LANG_PT = 1014

BUDGET_ID = -1
CAMPAIGN_ID = -2
AD_GROUP_ID = -3


def build_operations(client):
    ops = []

    # 1. Budget (nao compartilhado — exigencia de App Campaign)
    op = client.get_type("MutateOperation")
    b = op.campaign_budget_operation.create
    b.resource_name = f"customers/{CUSTOMER_ID}/campaignBudgets/{BUDGET_ID}"
    b.name = f"Budget {CAMPAIGN_NAME}"
    b.delivery_method = client.enums.BudgetDeliveryMethodEnum.STANDARD
    b.amount_micros = DAILY_BUDGET_MICROS
    b.explicitly_shared = False
    ops.append(op)

    # 2. Campaign (App Campaign)
    op = client.get_type("MutateOperation")
    c = op.campaign_operation.create
    c.resource_name = f"customers/{CUSTOMER_ID}/campaigns/{CAMPAIGN_ID}"
    c.name = CAMPAIGN_NAME
    c.advertising_channel_type = client.enums.AdvertisingChannelTypeEnum.MULTI_CHANNEL
    c.advertising_channel_sub_type = client.enums.AdvertisingChannelSubTypeEnum.APP_CAMPAIGN
    c.status = client.enums.CampaignStatusEnum.PAUSED
    c.contains_eu_political_advertising = client.enums.EuPoliticalAdvertisingStatusEnum.DOES_NOT_CONTAIN_EU_POLITICAL_ADVERTISING
    c.campaign_budget = f"customers/{CUSTOMER_ID}/campaignBudgets/{BUDGET_ID}"
    c.end_date_time = (datetime.date.today() + datetime.timedelta(days=30)).strftime("%Y-%m-%d 23:59:59")

    c.app_campaign_setting.app_id = APP_ID
    c.app_campaign_setting.app_store = client.enums.AppCampaignAppStoreEnum.GOOGLE_APP_STORE
    c.app_campaign_setting.bidding_strategy_goal_type = (
        client.enums.AppCampaignBiddingStrategyGoalTypeEnum.OPTIMIZE_INSTALLS_WITHOUT_TARGET_INSTALL_COST
    )
    # Bidding: maximize conversions (instalacoes), sem tCPA
    c.maximize_conversions._pb.SetInParent()
    ops.append(op)

    # 3. Ad Group
    op = client.get_type("MutateOperation")
    ag = op.ad_group_operation.create
    ag.resource_name = f"customers/{CUSTOMER_ID}/adGroups/{AD_GROUP_ID}"
    ag.name = "App Install BR"
    ag.campaign = f"customers/{CUSTOMER_ID}/campaigns/{CAMPAIGN_ID}"
    ag.status = client.enums.AdGroupStatusEnum.ENABLED
    ops.append(op)

    # 4. App Ad (assets de texto; Google combina automaticamente)
    op = client.get_type("MutateOperation")
    ad = op.ad_group_ad_operation.create
    ad.ad_group = f"customers/{CUSTOMER_ID}/adGroups/{AD_GROUP_ID}"
    ad.status = client.enums.AdGroupAdStatusEnum.ENABLED
    for h in HEADLINES:
        asset = client.get_type("AdTextAsset")
        asset.text = h
        ad.ad.app_ad.headlines.append(asset)
    for d in DESCRIPTIONS:
        asset = client.get_type("AdTextAsset")
        asset.text = d
        ad.ad.app_ad.descriptions.append(asset)
    ops.append(op)

    # 5. Geo Brasil
    op = client.get_type("MutateOperation")
    cc = op.campaign_criterion_operation.create
    cc.campaign = f"customers/{CUSTOMER_ID}/campaigns/{CAMPAIGN_ID}"
    cc.location.geo_target_constant = f"geoTargetConstants/{GEO_BRASIL}"
    ops.append(op)

    # 6. Idioma PT
    op = client.get_type("MutateOperation")
    cc = op.campaign_criterion_operation.create
    cc.campaign = f"customers/{CUSTOMER_ID}/campaigns/{CAMPAIGN_ID}"
    cc.language.language_constant = f"languageConstants/{LANG_PT}"
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
    print(f"App:        {APP_ID} (Google Play)")
    print(f"Orçamento:  R${DAILY_BUDGET_MICROS/1_000_000:.2f}/dia (~R${DAILY_BUDGET_MICROS/1_000_000*30:.0f}/30d)")
    print(f"Assets:     {len(HEADLINES)} headlines + {len(DESCRIPTIONS)} descriptions")
    print(f"Bidding:    Maximizar instalacoes (sem custo-alvo)")
    print(f"Geo:        Brasil / PT")
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
            for result in resp.mutate_operation_responses:
                for field in ["campaign_budget_result", "campaign_result", "ad_group_result",
                              "ad_group_ad_result", "campaign_criterion_result"]:
                    if result._pb.HasField(field):
                        print(f"  {getattr(result, field).resource_name}")
                        break

        print()
        if validate_only:
            print("=== DRY-RUN OK. Rode com --live para criar de verdade. ===")
        else:
            print("=== LIVE OK — campanha criada em PAUSED. Ativar na UI. ===")

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
