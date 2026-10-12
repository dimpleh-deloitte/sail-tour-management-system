import { randomUUID } from "node:crypto";
import { NextFunction, Request, Response } from "express";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      requestId: string;
    }
  }
}

export function requestId(req: Request, res: Response, next: NextFunction) {
  req.requestId = (req.headers["x-correlation-id"] as string) || randomUUID();
  res.setHeader("x-correlation-id", req.requestId);
  next();
}
