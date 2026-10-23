import { randomInt } from "node:crypto";
import { loadScriptEnv } from "./load-script-env";
import { normalizeIranianPhone } from "@/lib/auth/phone";
import { isSmsDevMode, sendSmsCode, SmsDeliveryError } from "@/lib/auth/sms-delivery";

loadScriptEnv();

async function main() {
  const phone = normalizeIranianPhone(process.argv[2] ?? "");
  if (!phone) {
    console.error("Usage: npm run sms:test -- <your-own-Iranian-phone>");
    process.exitCode = 1;
    return;
  }
  try {
    await sendSmsCode(phone, randomInt(100000, 1000000).toString());
    console.info(isSmsDevMode() ? "SMS development mode: no message sent." : "Provider accepted the test message. Check your handset; the test code cannot log in.");
  } catch (error) {
    console.error("SMS test failed:", error instanceof SmsDeliveryError ? error.code : "UNKNOWN_ERROR");
    process.exitCode = 1;
  }
}

void main();
