#!/usr/bin/env python3
"""
Ad schedule da campanha Search IBV FIPE Placa (24050523074), baseado na
analise de 30 dias de consultas (22/jul/2026): picos 10h e 14-15h, vale
morto 2h-6h, ter-qui como dias fortes.

Blocos por dia (horario da conta = America/Sao_Paulo):
  00:00-02:00  serve (madrugada ainda viva ate ~1h)
  02:00-06:00  EXCLUIDO (vale morto - sem bloco = sem veiculacao)
  06:00-10:00  serve
  10:00-16:00  serve; ter/qua/qui com bid +15%
  16:00-24:00  serve

Nota: com Maximize Clicks os bid modifiers de agenda sao ignorados (so a
EXCLUSAO tem efeito). Os +15% ficam armados pra quando a campanha migrar
pra estrategia com lances manuais/tCPA.

Uso: ./pc-ads-set-ad-schedule.py [--live]
"""
import argparse
import sys
from pathlib import Path

from google.ads.googleads.client import GoogleAdsClient
from google.ads.googleads.errors import GoogleAdsException

CRED_PATH = str(Path.home() / ".google-ads-credentials.yaml")
CUSTOMER_ID = "8711328209"
CAMPAIGN_ID = 24050523074

DAYS = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY"]
BOOST_DAYS = {"TUESDAY", "WEDNESDAY", "THURSDAY"}
# (start_hour, end_hour, boosted?)
BLOCKS = [(0, 2, False), (6, 10, False), (10, 16, True), (16, 24, False)]


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--live", action="store_true")
    args = parser.parse_args()
    validate_only = not args.live

    client = GoogleAdsClient.load_from_storage(CRED_PATH)
    svc = client.get_service("GoogleAdsService")
    day_enum = client.enums.DayOfWeekEnum
    minute_enum = client.enums.MinuteOfHourEnum

    ops = []
    for day in DAYS:
        for start, end, boosted in BLOCKS:
            op = client.get_type("MutateOperation")
            crit = op.campaign_criterion_operation.create
            crit.campaign = f"customers/{CUSTOMER_ID}/campaigns/{CAMPAIGN_ID}"
            crit.ad_schedule.day_of_week = getattr(day_enum, day)
            crit.ad_schedule.start_hour = start
            crit.ad_schedule.end_hour = end
            crit.ad_schedule.start_minute = minute_enum.ZERO
            crit.ad_schedule.end_minute = minute_enum.ZERO
            if boosted and day in BOOST_DAYS:
                crit.bid_modifier = 1.15
            ops.append(op)

    print(f"=== Modo: {'DRY-RUN' if validate_only else 'LIVE'} | {len(ops)} blocos de agenda ===")
    try:
        req = client.get_type("MutateGoogleAdsRequest")
        req.customer_id = CUSTOMER_ID
        req.mutate_operations.extend(ops)
        req.validate_only = validate_only
        svc.mutate(request=req)
        print("OK -", "validado" if validate_only else "aplicado")
    except GoogleAdsException as e:
        for err in e.failure.errors:
            print("ERRO:", err.message)
        sys.exit(1)


if __name__ == "__main__":
    main()
