import { apiSuccess } from "@/lib/api/response";
import { isEmailOtpEnabled } from "@/lib/auth/email-otp";
import { isSmsOtpEnabled } from "@/lib/auth/phone";
import { isSmsDeliveryConfigured } from "@/lib/auth/sms-delivery";
import { isEmailDeliveryConfigured } from "@/lib/email";

export const dynamic = "force-dynamic";

export function GET() {
  return apiSuccess({ sms: isSmsOtpEnabled() && isSmsDeliveryConfigured(), email: isEmailOtpEnabled() && isEmailDeliveryConfigured() }, {
    headers: { "Cache-Control": "private, no-store" },
  });
}
