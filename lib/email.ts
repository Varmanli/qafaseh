import nodemailer, { type Transporter } from "nodemailer";

export interface EmailMessage {
  to: string;
  replyTo?: string;
  subject: string;
  text: string;
  html: string;
}

export type EmailDeliveryResult =
  | { ok: true; messageId: string }
  | { ok: false; reason: "configuration" | "delivery" | "development" };

export const isDev = process.env.NODE_ENV !== "production";
export const isEmailDevMode =
  isDev &&
  (process.env.EMAIL_DEV_MODE === "true" || process.env.EMAIL_MODE === "dev");

export function canExposeResetTokenInDev() {
  return isEmailDevMode;
}

export type VerificationCodePurpose =
  | "email_verification"
  | "login"
  | "password_reset";

const SMTP_TIMEOUT_MS = 10_000;
let transporter: Transporter | undefined;

function getSmtpConfig() {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASSWORD;
  const port = Number(process.env.SMTP_PORT ?? "587");
  const from = process.env.MAIL_FROM;

  if (!host || !user || !pass || !from || !Number.isInteger(port) || port < 1 || port > 65535) {
    return null;
  }

  return { host, user, pass, port, from };
}

function getTransporter(config: NonNullable<ReturnType<typeof getSmtpConfig>>) {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.port === 465,
      requireTLS: config.port === 587,
      auth: { user: config.user, pass: config.pass },
      connectionTimeout: SMTP_TIMEOUT_MS,
      greetingTimeout: SMTP_TIMEOUT_MS,
      socketTimeout: SMTP_TIMEOUT_MS,
    });
  }
  return transporter;
}

function logEmailFailure(reason: string, error?: unknown) {
  const code = error && typeof error === "object" && "code" in error
    ? String(error.code)
    : undefined;
  console.error("[email] Delivery failed", { reason, ...(code ? { code } : {}) });
}

/** The single SMTP gateway for all application email. It never throws to callers. */
export async function sendEmail(message: EmailMessage): Promise<EmailDeliveryResult> {
  const config = getSmtpConfig();
  if (!config) {
    if (isEmailDevMode) {
      console.info("[email] Development mode: email delivery skipped.");
      return { ok: false, reason: "development" };
    }
    logEmailFailure("SMTP is not fully configured");
    return { ok: false, reason: "configuration" };
  }

  try {
    const result = await getTransporter(config).sendMail({
      from: config.from,
      to: message.to,
      ...(message.replyTo ? { replyTo: message.replyTo } : {}),
      subject: message.subject,
      text: message.text,
      html: message.html,
    });
    return { ok: true, messageId: result.messageId };
  } catch (error) {
    logEmailFailure("SMTP send error", error);
    return { ok: false, reason: "delivery" };
  }
}

export async function verifySmtpConnection(): Promise<EmailDeliveryResult> {
  const config = getSmtpConfig();
  if (!config) return { ok: false, reason: "configuration" };
  try {
    await getTransporter(config).verify();
    return { ok: true, messageId: "verified" };
  } catch (error) {
    logEmailFailure("SMTP verification error", error);
    return { ok: false, reason: "delivery" };
  }
}

export async function sendVerificationCodeEmail(params: {
  to: string;
  code: string;
  purpose: VerificationCodePurpose;
}) {
  const { verificationCodeEmail } = await import("@/lib/email/templates/verification-code");
  const template = verificationCodeEmail(params);
  return sendEmail({ to: params.to, ...template });
}

export async function sendPasswordResetEmail(params: { to: string; resetUrl: string }) {
  const { passwordResetEmail } = await import("@/lib/email/templates/password-reset");
  return sendEmail({ to: params.to, ...passwordResetEmail(params) });
}
