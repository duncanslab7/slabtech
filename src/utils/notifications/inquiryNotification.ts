/**
 * Email notification for new purchase inquiries and home-page applications.
 *
 * Sending is best-effort by design: a lead is already safely in the database
 * by the time this runs, so a mail failure must never surface to the person
 * who filled in the form. Every path here logs and returns instead of throwing.
 *
 * Config (all optional — with no RESEND_API_KEY this is a no-op):
 *   RESEND_API_KEY      Resend API key. Without it, nothing is sent.
 *   INQUIRY_NOTIFY_TO   Comma-separated recipients. Default duncan@slabtraining.com.
 *   RESEND_FROM         From header. Must be on a domain verified in Resend.
 *   NEXT_PUBLIC_SITE_URL Base URL used for the admin deep-link.
 */

import { Resend } from 'resend'

const DEFAULT_TO = 'duncan@slabtraining.com'
const DEFAULT_FROM = 'SLAB <noreply@slabtraining.com>'

export interface InquiryNotification {
  id: string
  productType: 'hoodie' | 'individual' | 'company'
  name: string
  email: string
  phone: string
  industry?: string | null
  paymentPlan?: string | null
  message?: string | null
  customData?: Record<string, unknown> | null
}

const PRODUCT_LABELS: Record<string, string> = {
  hoodie: 'Custom Hoodie',
  individual: 'Individual Access',
  company: 'Company Access',
}

/** Escape anything that came from a form before it goes into an HTML email. */
function esc(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function buildSubject(inq: InquiryNotification): string {
  const role = inq.customData?.role
  if (inq.customData?.source === 'home-apply') {
    const who = typeof role === 'string' ? role.toUpperCase() : 'APPLICANT'
    return `New application — ${inq.name} (${who})`
  }
  return `New ${PRODUCT_LABELS[inq.productType] ?? inq.productType} inquiry — ${inq.name}`
}

function row(label: string, value: string): string {
  return `
    <tr>
      <td style="padding:7px 16px 7px 0;color:#8A8A8A;font-size:12px;letter-spacing:.08em;white-space:nowrap;vertical-align:top;">${esc(label)}</td>
      <td style="padding:7px 0;color:#1A1A1A;font-size:14px;">${value}</td>
    </tr>`
}

function buildHtml(inq: InquiryNotification, adminUrl: string): string {
  const isApply = inq.customData?.source === 'home-apply'
  const rows: string[] = [
    row('NAME', esc(inq.name)),
    row('EMAIL', `<a href="mailto:${esc(inq.email)}" style="color:#C2560F;">${esc(inq.email)}</a>`),
    row('PHONE', `<a href="tel:${esc(inq.phone)}" style="color:#C2560F;">${esc(inq.phone)}</a>`),
  ]

  if (isApply) {
    rows.push(row('THEY ARE A', `<b>${esc(String(inq.customData?.role ?? 'unspecified')).toUpperCase()}</b>`))
    if (inq.customData?.company) rows.push(row('COMPANY / MARKET', esc(inq.customData.company)))
  } else {
    rows.push(row('PRODUCT', esc(PRODUCT_LABELS[inq.productType] ?? inq.productType)))
    if (inq.industry) rows.push(row('INDUSTRY', esc(inq.industry)))
    if (inq.paymentPlan) {
      rows.push(row('PAYMENT PLAN', inq.paymentPlan === 'summer' ? '$500 for the summer' : '$100/month'))
    }
  }

  const messageBlock = inq.message
    ? `<div style="margin-top:22px;">
         <div style="color:#8A8A8A;font-size:12px;letter-spacing:.08em;margin-bottom:7px;">WHAT THEY'RE CHASING</div>
         <div style="background:#F4F2ED;border-left:3px solid #F4711E;padding:14px 16px;color:#1A1A1A;font-size:14px;line-height:1.55;white-space:pre-wrap;">${esc(inq.message)}</div>
       </div>`
    : ''

  return `<!doctype html>
<html><body style="margin:0;padding:24px;background:#EDEAE2;font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;">
  <div style="max-width:560px;margin:0 auto;background:#FFFFFF;border:1px solid #DDD9D0;">
    <div style="background:#000000;padding:18px 24px;">
      <div style="color:#F4711E;font-size:12px;letter-spacing:.24em;font-weight:700;">
        ${isApply ? 'NEW APPLICATION' : 'NEW INQUIRY'}
      </div>
      <div style="color:#EDEAE2;font-size:20px;font-weight:700;margin-top:5px;">${esc(inq.name)}</div>
    </div>
    <div style="padding:24px;">
      <table cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;">${rows.join('')}</table>
      ${messageBlock}
      <div style="margin-top:28px;">
        <a href="${esc(adminUrl)}" style="display:inline-block;background:#F4711E;color:#000000;text-decoration:none;font-weight:700;font-size:14px;letter-spacing:.06em;padding:13px 22px;">
          OPEN IN ADMIN
        </a>
      </div>
      <div style="margin-top:22px;color:#9A968C;font-size:11px;">
        Reply to this email to answer ${esc(inq.name)} directly · inquiry ${esc(inq.id)}
      </div>
    </div>
  </div>
</body></html>`
}

/** Subject + body for one inquiry. Exported so it can be previewed without sending. */
export function renderInquiryEmail(inq: InquiryNotification, adminUrl: string) {
  return { subject: buildSubject(inq), html: buildHtml(inq, adminUrl) }
}

/**
 * Sends the notification. Never throws — returns whether a mail actually went out.
 */
export async function sendInquiryNotification(inq: InquiryNotification): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    console.warn(
      `[inquiry ${inq.id}] RESEND_API_KEY not set — inquiry saved but no notification email sent`
    )
    return false
  }

  const to = (process.env.INQUIRY_NOTIFY_TO ?? DEFAULT_TO)
    .split(',')
    .map((addr) => addr.trim())
    .filter(Boolean)

  if (to.length === 0) {
    console.warn(`[inquiry ${inq.id}] INQUIRY_NOTIFY_TO is empty — no notification sent`)
    return false
  }

  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://slabtraining.com'
  const adminUrl = `${baseUrl.replace(/\/$/, '')}/purchase-inquiries`

  try {
    const { subject, html } = renderInquiryEmail(inq, adminUrl)
    const { error } = await new Resend(apiKey).emails.send({
      from: process.env.RESEND_FROM ?? DEFAULT_FROM,
      to,
      // so hitting reply in the inbox goes straight back to the applicant
      replyTo: inq.email,
      subject,
      html,
    })

    if (error) {
      console.error(`[inquiry ${inq.id}] Resend rejected the notification:`, error)
      return false
    }

    console.log(`[inquiry ${inq.id}] notification sent to ${to.length} recipient(s)`)
    return true
  } catch (err) {
    console.error(`[inquiry ${inq.id}] Failed to send notification:`, err)
    return false
  }
}
