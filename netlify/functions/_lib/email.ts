import nodemailer from "nodemailer";

const SMTP_HOST = process.env.SMTP_HOST || "smtp.hostinger.com";
const SMTP_PORT = Number(process.env.SMTP_PORT || 465);
const SMTP_SECURE = String(process.env.SMTP_SECURE || (SMTP_PORT === 465 ? "true" : "false")).toLowerCase() !== "false";
const SMTP_USER = process.env.SMTP_USER || "falah@nuqtai.com";
const SMTP_PASS = process.env.SMTP_PASS || process.env.MAIL_PASSWORD || process.env.EMAIL_PASSWORD || "";
const MAIL_FROM = process.env.MAIL_FROM || `Nuqt AI <${SMTP_USER}>`;
const APP_BASE_URL =
  process.env.APP_BASE_URL ||
  process.env.URL ||
  process.env.DEPLOY_PRIME_URL ||
  process.env.DEPLOY_URL ||
  "";

let transporter: nodemailer.Transporter | null = null;

type EmailResult =
  | { sent: true; messageId: string }
  | { sent: false; skipped: true; reason: string }
  | { sent: false; skipped?: false; reason: string };

function isEmailConfigured() {
  return Boolean(SMTP_HOST && SMTP_PORT && SMTP_USER && SMTP_PASS);
}

function getMissingEmailConfigFields() {
  const missing: string[] = [];

  if (!SMTP_HOST) missing.push("SMTP_HOST");
  if (!SMTP_PORT) missing.push("SMTP_PORT");
  if (!SMTP_USER) missing.push("SMTP_USER");
  if (!SMTP_PASS) missing.push("SMTP_PASS");

  return missing;
}

function getTransporter() {
  if (!isEmailConfigured()) {
    return null;
  }

  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_SECURE,
      auth: {
        user: SMTP_USER,
        pass: SMTP_PASS,
      },
    });
  }

  return transporter;
}

function getLoginUrl() {
  if (!APP_BASE_URL) {
    return null;
  }

  const normalizedBaseUrl = APP_BASE_URL.startsWith("http")
    ? APP_BASE_URL
    : `https://${APP_BASE_URL}`;

  return `${normalizedBaseUrl.replace(/\/$/, "")}/login`;
}

function buildApprovalEmail(toEmail: string) {
  const loginUrl = getLoginUrl();
  const subject = "تمت الموافقة على حسابك في المساعد القانوني الذكي";
  const textLines = [
    `مرحباً ${toEmail}،`,
    "",
    "يسرنا إبلاغك بأنه تمت الموافقة على حسابك في منصة المساعد القانوني الذكي.",
    "يمكنك الآن تسجيل الدخول والاستفادة من خدمة الشات بوت القانوني.",
    loginUrl ? `رابط تسجيل الدخول: ${loginUrl}` : "يمكنك الآن الدخول إلى الموقع باستخدام بريدك الإلكتروني وكلمة المرور الخاصة بك.",
    "",
    "مع خالص التحية،",
    "فريق المساعد القانوني الذكي",
  ];

  const html = `
    <div dir="rtl" style="background:#f5f7fb;padding:32px 16px;font-family:Tahoma,Arial,sans-serif;color:#111827;">
      <div style="max-width:640px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:20px;overflow:hidden;">
        <div style="background:#111827;padding:28px 32px;color:#ffffff;text-align:right;">
          <div style="font-size:14px;opacity:0.8;margin-bottom:8px;">Nuqt AI</div>
          <h1 style="margin:0;font-size:28px;line-height:1.4;">تمت الموافقة على حسابك</h1>
        </div>
        <div style="padding:32px;text-align:right;line-height:1.9;font-size:16px;">
          <p style="margin:0 0 16px;">مرحباً،</p>
          <p style="margin:0 0 16px;">
            يسرنا إبلاغك بأنه تمت الموافقة على حسابك في <strong>المساعد القانوني الذكي</strong>.
          </p>
          <p style="margin:0 0 16px;">
            يمكنك الآن تسجيل الدخول إلى المنصة والاستفادة من خدمة الشات بوت القانوني والاطلاع على الإجابات القانونية المتاحة عبر النظام.
          </p>
          ${
            loginUrl
              ? `<div style="margin:24px 0 28px;text-align:center;">
                   <a href="${loginUrl}" style="display:inline-block;background:#111827;color:#ffffff;text-decoration:none;padding:14px 28px;border-radius:12px;font-weight:700;">
                     تسجيل الدخول
                   </a>
                 </div>`
              : ""
          }
          <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:14px;padding:16px 18px;margin:20px 0;">
            <div style="font-weight:700;margin-bottom:6px;">ملاحظة</div>
            <div>يمكنك الدخول باستخدام البريد الإلكتروني وكلمة المرور التي قمت بتسجيلها مسبقاً.</div>
          </div>
          <p style="margin:24px 0 0;">مع خالص التحية،<br />فريق المساعد القانوني الذكي</p>
        </div>
      </div>
    </div>
  `;

  return {
    subject,
    text: textLines.join("\n"),
    html,
  };
}

export async function sendApprovalEmail(toEmail: string): Promise<EmailResult> {
  if (!toEmail) {
    return { sent: false, skipped: true, reason: "missing_recipient" };
  }

  const mailer = getTransporter();
  if (!mailer) {
    const missingFields = getMissingEmailConfigFields();
    console.warn("Approval email skipped: SMTP configuration is incomplete.");
    return {
      sent: false,
      skipped: true,
      reason: missingFields.length > 0
        ? `missing_smtp_config:${missingFields.join(",")}`
        : "missing_smtp_config",
    };
  }

  try {
    const mail = buildApprovalEmail(toEmail);
    const info = await mailer.sendMail({
      from: MAIL_FROM,
      to: toEmail,
      subject: mail.subject,
      text: mail.text,
      html: mail.html,
    });

    return {
      sent: true,
      messageId: info.messageId,
    };
  } catch (error) {
    console.error("Failed to send approval email:", error);
    return {
      sent: false,
      reason: error instanceof Error ? error.message : "unknown_email_error",
    };
  }
}
