import { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";

export class ApiError extends Error {
  status: number;
  code: string;
  fieldErrors?: Record<string, string>;

  constructor(status: number, code: string, message: string, fieldErrors?: Record<string, string>) {
    super(message);
    this.status = status;
    this.code = code;
    this.fieldErrors = fieldErrors;
  }
}

// Central error format: stable error code + human-readable message + field
// errors where relevant (SSoT §18). Never leaks stack traces or secrets.
export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction) {
  const correlationId = req.requestId;

  if (err instanceof ApiError) {
    return res.status(err.status).json({
      error: { code: err.code, message: err.message, fieldErrors: err.fieldErrors },
      correlationId,
    });
  }

  if (err instanceof ZodError) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of err.issues) {
      fieldErrors[issue.path.join(".") || "_"] = issue.message;
    }
    return res.status(400).json({
      error: { code: "VALIDATION_ERROR", message: "Request failed validation.", fieldErrors },
      correlationId,
    });
  }

  const anyErr = err as { code?: string; message?: string };
  if (anyErr?.code === "INVALID_WORKFLOW_TRANSITION" || anyErr?.code === "TA_RULE_NOT_FOUND") {
    return res.status(409).json({
      error: { code: anyErr.code, message: anyErr.message ?? "Conflict." },
      correlationId,
    });
  }

  // eslint-disable-next-line no-console
  console.error(`[${correlationId}]`, err);
  return res.status(500).json({
    error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred." },
    correlationId,
  });
}
