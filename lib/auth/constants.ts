// ثابت‌های احراز هویت بدون هیچ وابستگی به Node،
// تا بتوان آن‌ها را در رانتایم edge (middleware) هم وارد کرد.

// __Host- prevents sibling subdomains from planting a parent-domain session.
export const AUTH_COOKIE = process.env.NODE_ENV === "production" ? "__Host-token" : "token";

// توکن یک هفته اعتبار دارد
export const TOKEN_TTL_SECONDS = 7 * 24 * 60 * 60;
