"""Email service via SendGrid with MOCKED fallback when no API key."""
import os
import logging
from typing import Optional

logger = logging.getLogger(__name__)


class EmailService:
    """Sends transactional emails via SendGrid. Falls back to MOCKED logging when no key."""

    def __init__(self):
        self.api_key = os.environ.get("SENDGRID_API_KEY", "").strip()
        self.from_email = os.environ.get("SENDGRID_FROM_EMAIL", "noreply@rurapp.co")
        self.from_name = os.environ.get("SENDGRID_FROM_NAME", "Rurapp")
        self.enabled = bool(self.api_key)
        if not self.enabled:
            logger.warning("[MOCKED EMAIL] SENDGRID_API_KEY not set. Emails will be logged only.")

    async def send(
        self,
        to_email: str,
        subject: str,
        html: str,
        text: Optional[str] = None,
    ) -> dict:
        if not self.enabled:
            logger.info("[MOCKED EMAIL] To=%s | Subject=%s", to_email, subject)
            logger.info("[MOCKED EMAIL] Body preview: %s", html[:200].replace("\n", " "))
            return {"status": "mocked", "to": to_email}
        try:
            from sendgrid import SendGridAPIClient
            from sendgrid.helpers.mail import Mail, Email, To, HtmlContent

            sg = SendGridAPIClient(self.api_key)
            msg = Mail(
                from_email=Email(self.from_email, self.from_name),
                to_emails=To(to_email),
                subject=subject,
                html_content=HtmlContent(html),
            )
            if text:
                msg.plain_text_content = text
            resp = sg.send(msg)
            logger.info("Email sent to %s status=%s", to_email, resp.status_code)
            return {"status": "sent", "code": resp.status_code, "to": to_email}
        except Exception as e:
            logger.exception("Email send error: %s", e)
            return {"status": "error", "error": str(e), "to": to_email}


_service: Optional[EmailService] = None


def email_service() -> EmailService:
    global _service
    if _service is None:
        _service = EmailService()
    return _service


# === Templates ===
def _wrap(title: str, body: str) -> str:
    return f"""
    <div style="font-family: 'Work Sans', Arial, sans-serif; background:#FDFBF7; padding:24px; color:#1C1C1C;">
      <div style="max-width:560px; margin:0 auto; background:#fff; border:1px solid #E6E2D8; border-radius:16px; overflow:hidden;">
        <div style="background:#2D5A27; padding:18px 24px; color:#fff;">
          <div style="font-weight:700; font-size:20px;">🌱 Rurapp</div>
          <div style="opacity:0.85; font-size:12px; letter-spacing:2px; text-transform:uppercase;">Del campo a tu mesa</div>
        </div>
        <div style="padding:24px;">
          <h2 style="margin:0 0 12px 0; font-size:22px; color:#1C1C1C;">{title}</h2>
          {body}
        </div>
        <div style="padding:14px 24px; border-top:1px solid #E6E2D8; color:#7A7A7A; font-size:12px;">
          Conectando el campo y la ciudad · Rurapp · Hecho en Colombia
        </div>
      </div>
    </div>"""


async def send_order_confirmation(to_email: str, customer_name: str, order_id: str, total: float, items_count: int):
    body = f"""
      <p>Hola {customer_name}, confirmamos que tu pedido fue recibido y está siendo procesado.</p>
      <p><strong>Pedido:</strong> #{order_id[:8]}<br/>
      <strong>Productos:</strong> {items_count}<br/>
      <strong>Total:</strong> ${total:,.0f} COP</p>
      <p>El productor preparará tu pedido pronto.</p>"""
    return await email_service().send(to_email, f"Pedido confirmado · #{order_id[:8]}", _wrap("¡Pedido confirmado!", body))


async def send_booking_confirmation(to_email: str, customer_name: str, booking_id: str, service_title: str, expert_name: str, scheduled_at: str):
    body = f"""
      <p>Hola {customer_name}, tu cita fue confirmada.</p>
      <p><strong>Servicio:</strong> {service_title}<br/>
      <strong>Experto:</strong> {expert_name}<br/>
      <strong>Fecha:</strong> {scheduled_at}</p>
      <p>El experto se pondrá en contacto contigo.</p>"""
    return await email_service().send(to_email, f"Cita confirmada · {service_title}", _wrap("¡Cita confirmada!", body))


async def send_membership_receipt(to_email: str, name: str, plan_name: str, amount: float, expires_at: str):
    body = f"""
      <p>Hola {name}, tu membresía está activa.</p>
      <p><strong>Plan:</strong> {plan_name}<br/>
      <strong>Pagado:</strong> ${amount:,.2f} USD<br/>
      <strong>Vigente hasta:</strong> {expires_at}</p>
      <p>Ya puedes publicar y recibir pedidos/citas en Rurapp.</p>"""
    return await email_service().send(to_email, f"Membresía activa · {plan_name}", _wrap("¡Membresía activa!", body))


async def send_chat_notification(to_email: str, recipient_name: str, sender_name: str, preview: str, link: str):
    body = f"""
      <p>Hola {recipient_name}, tienes un mensaje nuevo de <strong>{sender_name}</strong>.</p>
      <blockquote style="border-left:3px solid #2D5A27; padding:8px 12px; background:#EAF0E9; margin:14px 0; color:#1C1C1C;">{preview[:200]}</blockquote>
      <p><a href="{link}" style="display:inline-block; background:#2D5A27; color:#fff; padding:10px 18px; border-radius:10px; text-decoration:none;">Responder en Rurapp</a></p>"""
    return await email_service().send(to_email, f"Nuevo mensaje de {sender_name}", _wrap("Nuevo mensaje", body))
