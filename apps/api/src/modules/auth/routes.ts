// Auth module — SSoT §25: real SSO/OIDC provider is TBD. This router only
// exposes a mock dev-login (guarded by AUTH_USE_MOCK_PROVIDER) plus the
// session-derived /me endpoint every other module relies on for identity.
import { Router } from "express";
import { z } from "zod";
import { env } from "../../config/env.js";
import { store } from "../../repository/store.js";
import { issueMockSession, clearSession, requireAuth } from "../../middleware/auth.js";
import { ApiError } from "../../middleware/error-handler.js";

export const authRouter = Router();

const loginSchema = z.object({ personNumber: z.string().min(1) });

// POST /api/v1/auth/dev-login — MOCK ONLY. Disabled unless
// AUTH_USE_MOCK_PROVIDER=true. Stands in for the real SSO redirect/callback
// flow (provider TBD) so the app is runnable end-to-end today.
authRouter.post("/auth/dev-login", (req, res) => {
  if (!env.auth.useMockProvider) {
    throw new ApiError(404, "NOT_FOUND", "Mock login is disabled.");
  }
  const { personNumber } = loginSchema.parse(req.body);
  const employee = store.employees.find((e) => e.personNumber === personNumber);
  if (!employee) {
    throw new ApiError(401, "INVALID_CREDENTIALS", "No employee found for that Staff No.");
  }
  issueMockSession(res, employee.personNumber);
  res.json({ data: employee });
});

authRouter.post("/auth/logout", (_req, res) => {
  clearSession(res);
  res.status(204).send();
});

// GET /api/v1/me — SSoT §19: current authenticated employee/roles.
// Never trust a client-submitted identity for anything else (SSoT VAL-01).
authRouter.get("/me", requireAuth, (req, res) => {
  res.json({ data: req.user });
});

// Convenience for local dev/demo: lists the mock directory so a frontend
// login screen can offer a picker instead of requiring a known Staff No.
authRouter.get("/auth/dev-directory", (_req, res) => {
  if (!env.auth.useMockProvider) {
    throw new ApiError(404, "NOT_FOUND", "Mock directory is disabled.");
  }
  res.json({ data: store.employees.map((e) => ({ personNumber: e.personNumber, name: e.name, roles: e.roles })) });
});
