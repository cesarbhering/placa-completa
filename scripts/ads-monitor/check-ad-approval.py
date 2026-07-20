#!/usr/bin/env python3
"""
Monitora a aprovacao dos anuncios da campanha IBV FIPE Placa (24050523074).
Polla a cada 30 min. Quando todos os 3 anuncios sairem de REVIEW_IN_PROGRESS,
envia email via pc-mail com o resultado e encerra.

Roda como systemd transient unit (sobrevive fim de sessao).
"""
import subprocess
import time
from datetime import datetime
from pathlib import Path

from google.ads.googleads.client import GoogleAdsClient

CRED = str(Path.home() / ".google-ads-credentials.yaml")
CUSTOMER_ID = "8711328209"
CAMPAIGN_ID = 24050523074
TO = "cesar.bhering@placacompleta.com.br"
POLL_SECONDS = 30 * 60
MAX_HOURS = 72  # desiste depois de 3 dias e avisa

LOG = Path("/opt/ads-monitor/monitor.log")


def log(msg: str) -> None:
    line = f"[{datetime.now().isoformat(timespec='seconds')}] {msg}"
    print(line, flush=True)
    with LOG.open("a") as f:
        f.write(line + "\n")


def check():
    client = GoogleAdsClient.load_from_storage(CRED)
    svc = client.get_service("GoogleAdsService")
    q = f"""
        SELECT ad_group_ad.ad.id,
               ad_group_ad.policy_summary.approval_status,
               ad_group_ad.policy_summary.review_status,
               ad_group_ad.policy_summary.policy_topic_entries
        FROM ad_group_ad
        WHERE campaign.id = {CAMPAIGN_ID}
    """
    ads = []
    for row in svc.search(customer_id=CUSTOMER_ID, query=q):
        ps = row.ad_group_ad.policy_summary
        topics = [t.topic for t in ps.policy_topic_entries]
        ads.append({
            "id": row.ad_group_ad.ad.id,
            "approval": ps.approval_status.name,
            "review": ps.review_status.name,
            "topics": topics,
        })
    return ads


def send_mail(subject: str, body: str) -> None:
    subprocess.run(
        ["pc-mail", "--to", TO, "--subject", subject, "--reply-to", TO, "--body", body],
        check=False,
    )


def main() -> None:
    log("monitor iniciado")
    deadline = time.time() + MAX_HOURS * 3600
    while time.time() < deadline:
        try:
            ads = check()
        except Exception as e:
            log(f"erro na consulta ({type(e).__name__}): {e}")
            # erro de auth (token expirado) merece aviso imediato
            if "invalid_grant" in str(e) or "unauthenticated" in str(e).lower():
                send_mail(
                    "[Ads] Monitor parou: erro de autenticacao",
                    "O monitor de aprovacao dos anuncios falhou com erro de autenticacao.\n"
                    "Provavel causa: refresh token do modo Teste expirou (validade 7 dias).\n"
                    "Peca ao Claude para gerar nova URL de autorizacao e reiniciar o monitor.",
                )
                return
            time.sleep(POLL_SECONDS)
            continue

        pending = [a for a in ads if a["review"] == "REVIEW_IN_PROGRESS"]
        log(f"status: {[(a['id'], a['approval'], a['review']) for a in ads]}")

        if not pending:
            approved = [a for a in ads if a["approval"] in ("APPROVED", "APPROVED_LIMITED")]
            disapproved = [a for a in ads if a["approval"] == "DISAPPROVED"]

            lines = ["Analise dos anuncios da campanha IBV FIPE Placa concluida.", ""]
            for a in ads:
                lines.append(f"- Anuncio {a['id']}: {a['approval']}")
                for t in a["topics"]:
                    lines.append(f"    politica: {t}")
            lines.append("")
            if disapproved:
                lines.append(f"ATENCAO: {len(disapproved)} anuncio(s) REPROVADO(S).")
                lines.append("Ver detalhes em ads.google.com > Campanhas > Anuncios.")
                lines.append("Me chame na sessao que a gente corrige o copy e reenvia.")
                subject = f"[Ads] {len(disapproved)} anuncio(s) reprovado(s), acao necessaria"
            elif any(a["approval"] == "APPROVED_LIMITED" for a in ads):
                lines.append("Todos aprovados, mas alguns com veiculacao limitada (APPROVED_LIMITED).")
                lines.append("Normalmente ok pra rodar; detalhes na UI.")
                subject = "[Ads] Anuncios aprovados (alguns com limitacao)"
            else:
                lines.append("Todos os 3 anuncios aprovados sem restricao. Campanha veiculando.")
                subject = "[Ads] Anuncios aprovados, campanha no ar"

            send_mail(subject, "\n".join(lines))
            log(f"email enviado: {subject}")
            return

        time.sleep(POLL_SECONDS)

    send_mail(
        "[Ads] Analise dos anuncios ainda pendente apos 72h",
        "Os anuncios da campanha IBV FIPE Placa continuam em analise apos 72 horas.\n"
        "Isso e incomum (normal: ate 1 dia util). Vale checar na UI ou abrir chamado no suporte Google Ads.",
    )
    log("timeout de 72h atingido")


if __name__ == "__main__":
    main()
