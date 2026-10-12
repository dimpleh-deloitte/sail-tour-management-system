// Central environment/config loader. No secrets are hard-coded here — real
// values come from process.env (see .env.example at the repo root). Several
// fields are explicitly TBD per the SSoT (§25) and are represented as
// nullable/mock-mode flags rather than invented values.

export const env = {
  nodeEnv: process.env.NODE_ENV ?? "development",
  port: Number(process.env.PORT ?? 4000),
  apiBasePath: process.env.API_BASE_PATH ?? "/api/v1",
  corsAllowedOrigins: (process.env.CORS_ALLOWED_ORIGINS ?? "http://localhost:5173").split(","),

  // Oracle DB connection — used only when DATA_MODE=oracle (see repository/).
  dataMode: (process.env.DATA_MODE ?? "memory") as "memory" | "oracle",
  oracle: {
    user: process.env.ORACLE_DB_USER,
    password: process.env.ORACLE_DB_PASSWORD,
    connectString: process.env.ORACLE_DB_CONNECT_STRING,
  },

  // Auth — SSO provider is TBD (SSoT §25); mock provider issues local dev
  // sessions so the app is runnable end-to-end today.
  auth: {
    useMockProvider: (process.env.AUTH_USE_MOCK_PROVIDER ?? "true") === "true",
    sessionCookieSecret: process.env.SESSION_COOKIE_SECRET ?? "dev-only-insecure-secret",
  },

  // Fusion HCM — exact endpoints/credentials are TBD (SSoT §25); mock
  // adapter returns a small deterministic employee directory for dev/demo.
  hcm: {
    useMockAdapter: (process.env.HCM_USE_MOCK_ADAPTER ?? "true") === "true",
    baseUrl: process.env.FUSION_HCM_BASE_URL,
  },

  attachments: {
    maxFileSizeMb: Number(process.env.ATTACHMENT_MAX_FILE_SIZE_MB ?? 5), // TBD in SSoT; conservative dev default
    maxCount: 3, // SSoT §10 — confirmed
    allowedExtensions: ["jpeg", "jpg", "png", "bmp", "pdf"], // SSoT §10 — confirmed
  },

  logLevel: process.env.LOG_LEVEL ?? "info",
};
