// Authentication/session middleware.
// SSoT §22/§25: exact SSO/OIDC provider is TBD; server-side identity is
// authoritative and MUST NOT be trusted from the client body (SSoT VAL-01).
// The mock provider below issues a signed, HTTP-only session cookie after a
// dev-only local login and is used only when AUTH_USE_MOCK_PROVIDER=true.
// Swap in a real OIDC/SSO session verifier in this same file (replacing
// verifyMockSession) once the provider is confirmed — callers only depend
// on req.user being populated, never on how it got there.
import crypto from "node:crypto";
import { NextFunction, Request, Response } from "express";
import { env } from "../config/env.js";
import { store } from "../repository/store.js";
import { Employee, RoleCode } from "../types.js";
import { ApiError } from "./error-handler.js";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: Employee;
    }
  }
}

const COOKIE_NAME = "sail_session";

function sign(payload: string): string {
  return crypto.createHmac("sha256", env.auth.sessionCookieSecret).update(payload).digest("hex");
}

export function issueMockSession(res: Response, personNumber: string) {
  const payload = JSON.stringify({ personNumber, issuedAt: Date.now() });
  const encoded = Buffer.from(payload).toString("base64url");
  const signature = sign(encoded);
  res.cookie(COOKIE_NAME, `${encoded}.${signature}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: env.nodeEnv === "production",
    maxAge: 1000 * 60 * 60 * 8,
  });
}

export function clearSession(res: Response) {
  res.clearCookie(COOKIE_NAME);
}

function verifyMockSession(cookieValue: string | undefined): string | null {
  if (!cookieValue) return null;
  const [encoded, signature] = cookieValue.split(".");
  if (!encoded || !signature) return null;
  if (sign(encoded) !== signature) return null;
  try {
    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
    return payload.personNumber ?? null;
  } catch {
    return null;
  }
}

// Populates req.user when a valid session exists; does not itself reject
// unauthenticated requests (see requireAuth for that).
export function attachUser(req: Request, _res: Response, next: NextFunction) {
  const personNumber = env.auth.useMockProvider
    ? verifyMockSession(req.cookies?.[COOKIE_NAME])
    : null; // real SSO verification goes here once the provider is confirmed (TBD)

  if (personNumber) {
    const employee = store.employees.find((e) => e.personNumber === personNumber);
    if (employee) {
      req.user = employee;
    }
  }
  next();
}

export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  if (!req.user) {
    throw new ApiError(401, "UNAUTHENTICATED", "Sign in required.");
  }
  next();
}

// Server-side authorization: never trust a role claimed by the client body
// (SSoT §22). Always checks req.user's roles as resolved from the session.
export function requireRole(...roles: RoleCode[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) {
      throw new ApiError(401, "UNAUTHENTICATED", "Sign in required.");
    }
    const hasRole = req.user.roles.some((r) => roles.includes(r));
    if (!hasRole) {
      throw new ApiError(403, "FORBIDDEN", `Requires one of roles: ${roles.join(", ")}.`);
    }
    next();
  };
}
