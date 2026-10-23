import jwt from "jsonwebtoken";
import { getJwtSecret } from "@/lib/jwt";

// This ticket proves completion of the phone step, never ownership of the phone.
export function createSignupToken(phone: string) {
  return jwt.sign({ phone, purpose: "phone_signup" }, getJwtSecret(), {
    algorithm: "HS256", expiresIn: "15m", audience: "phone-signup",
  });
}

export function verifySignupToken(token: string, phone: string): boolean {
  try {
    if (token.length > 2048) return false;
    const payload = jwt.verify(token, getJwtSecret(), { algorithms: ["HS256"], audience: "phone-signup" });
    return typeof payload === "object" && payload.purpose === "phone_signup" &&
      payload.phone === phone && typeof payload.exp === "number";
  } catch {
    return false;
  }
}
