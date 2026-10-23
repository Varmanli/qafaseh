import { normalizeIranianPhone } from "./phone";

export class SmsDeliveryError extends Error {
  constructor(public code: "SMS_NOT_CONFIGURED" | "SMS_DELIVERY_FAILED") {
    super(code);
    this.name = "SmsDeliveryError";
  }
}

export function isSmsDevMode() {
  return process.env.NODE_ENV !== "production" && process.env.SMS_DEV_MODE === "true";
}

export function isSmsDeliveryConfigured() {
  return isSmsDevMode() || getSmsConfig() !== null;
}

function getSmsConfig() {
  // Preserve existing Kavenegar setups; new installations select SMS.ir explicitly.
  const provider = process.env.SMS_PROVIDER?.trim() || "kavenegar";
  if (provider === "smsir") {
    const key = process.env.SMSIR_API_KEY?.trim();
    const rawId = process.env.SMSIR_OTP_TEMPLATE_ID?.trim() ?? "";
    const templateId = Number(rawId);
    const parameter = process.env.SMSIR_OTP_PARAMETER?.trim() || "CODE";
    if (!key || !/^\d+$/.test(rawId) || !Number.isSafeInteger(templateId) || templateId <= 0 || !/^[A-Za-z][A-Za-z0-9_]{0,49}$/.test(parameter)) return null;
    return { provider, key, templateId, parameter } as const;
  }
  if (provider !== "kavenegar") return null;
  const key = process.env.KAVENEGAR_API_KEY?.trim();
  const template = process.env.KAVENEGAR_OTP_TEMPLATE?.trim();
  return key && template ? { provider, key, template } as const : null;
}

/** Provider accepts the message; this does not claim final handset delivery. */
export async function sendSmsCode(phone: string, code: string): Promise<void> {
  const normalized = normalizeIranianPhone(phone);
  if (!normalized || !/^\d{6}$/.test(code)) throw new SmsDeliveryError("SMS_DELIVERY_FAILED");
  if (isSmsDevMode()) return;
  const config = getSmsConfig();
  if (!config) throw new SmsDeliveryError("SMS_NOT_CONFIGURED");
  try {
    if (config.provider === "smsir") {
      const response = await fetch("https://api.sms.ir/v1/send/verify", {
        method: "POST", redirect: "error", cache: "no-store", signal: AbortSignal.timeout(10_000),
        headers: { "Content-Type": "application/json", "X-API-KEY": config.key },
        body: JSON.stringify({ mobile: `0${normalized.slice(3)}`, templateId: config.templateId, parameters: [{ name: config.parameter, value: code }] }),
      });
      const result = await response.json() as { status?: number; data?: { messageId?: number } };
      if (!response.ok || result.status !== 1 || !Number.isSafeInteger(result.data?.messageId) || (result.data?.messageId ?? 0) <= 0) {
        throw new SmsDeliveryError("SMS_DELIVERY_FAILED");
      }
      return;
    }
    const response = await fetch(`https://api.kavenegar.com/v1/${encodeURIComponent(config.key)}/verify/lookup.json`, {
      method: "POST", redirect: "error", cache: "no-store", signal: AbortSignal.timeout(10_000),
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ receptor: `0${normalized.slice(3)}`, token: code, template: config.template, type: "sms" }),
    });
    const result = await response.json() as { return?: { status?: number }; entries?: { messageid?: number; status?: number }[] };
    const entry = result.entries?.[0];
    if (!response.ok || result.return?.status !== 200 || !entry?.messageid || [6, 11, 13, 14, 100].includes(entry.status ?? 0)) {
      throw new SmsDeliveryError("SMS_DELIVERY_FAILED");
    }
  } catch {
    // Never log raw fetch errors: Kavenegar puts the private API key in the URL.
    throw new SmsDeliveryError("SMS_DELIVERY_FAILED");
  }
}
