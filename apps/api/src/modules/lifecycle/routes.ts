// Post-approval lifecycle endpoints (client requirements 2, 3, 4 and 7).
import { Router } from "express";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import {
  cancelSchema,
  extensionDecisionSchema,
  extensionRequestSchema,
  journeyStartSchema,
  specialApprovalSchema,
  withdrawAdvanceSchema,
} from "../tours/dto.js";
import { z } from "zod";
import * as lifecycle from "./service.js";

export const lifecycleRouter = Router();
lifecycleRouter.use(requireAuth);

// POST /api/v1/tours/:id/journey-start — requirement 2.
// Role is not constrained here: the service decides whether the caller is the
// employee or their Forwarding Authority, and rejects anyone else.
lifecycleRouter.post("/tours/:id/journey-start", (req, res) => {
  const input = journeyStartSchema.parse(req.body);
  res.json({ data: lifecycle.acknowledgeJourneyStart(req.user!, req.params.id, input) });
});

// POST /api/v1/tours/:id/cancel — requirement 3.
lifecycleRouter.post("/tours/:id/cancel", (req, res) => {
  const input = cancelSchema.parse(req.body);
  res.json({ data: lifecycle.cancel(req.user!, req.params.id, input) });
});

// POST /api/v1/tours/:id/withdraw-advance — requirement 3.
lifecycleRouter.post("/tours/:id/withdraw-advance", (req, res) => {
  const input = withdrawAdvanceSchema.parse(req.body);
  res.json({ data: lifecycle.withdrawAdvance(req.user!, req.params.id, input) });
});

// POST /api/v1/tours/:id/extend — requirement 4.
lifecycleRouter.post("/tours/:id/extend", (req, res) => {
  const input = extensionRequestSchema.parse(req.body);
  res.json({ data: lifecycle.requestExtension(req.user!, req.params.id, input) });
});

// POST /api/v1/tours/:id/extension-decision — requirement 4 (Approving Authority).
lifecycleRouter.post("/tours/:id/extension-decision", requireRole("APPROVING"), (req, res) => {
  const input = extensionDecisionSchema.parse(req.body);
  res.json({ data: lifecycle.decideExtension(req.user!, req.params.id, input) });
});

// POST /api/v1/tours/:id/special-approval — requirement 7 (>500km acknowledgement).
lifecycleRouter.post("/tours/:id/special-approval", requireRole("APPROVING"), (req, res) => {
  const input = specialApprovalSchema.parse(req.body);
  res.json({ data: lifecycle.acknowledgeSpecialApproval(req.user!, req.params.id, input) });
});

const completeSchema = z.object({
  expectedVersion: z.number().int().positive(),
  remarks: z.string().max(2000).nullable().optional(),
});

// POST /api/v1/tours/:id/complete — gateway into settlement (§11).
lifecycleRouter.post("/tours/:id/complete", (req, res) => {
  const { expectedVersion, remarks } = completeSchema.parse(req.body);
  res.json({ data: lifecycle.completeTour(req.user!, req.params.id, expectedVersion, remarks ?? null) });
});
