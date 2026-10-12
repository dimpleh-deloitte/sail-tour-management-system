// Bill settlement endpoints — §11 (client requirement 8).
import { Router } from "express";
import { z } from "zod";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { settlementDecisionSchema, settlementSubmitSchema, settlementLineInputSchema } from "../tours/dto.js";
import { store } from "../../repository/store.js";
import { ApiError } from "../../middleware/error-handler.js";
import * as settlement from "./service.js";

export const settlementRouter = Router();
settlementRouter.use(requireAuth);

// GET /api/v1/settlements/worklist — everything settlement-related that
// concerns this user, so a §11 deadline is discoverable from the sidebar
// instead of only from an individual tour's detail page.
settlementRouter.get("/settlements/worklist", (req, res) => {
  res.json({ data: settlement.settlementWorklist(req.user!) });
});

const previewSchema = z.object({
  lines: z.array(settlementLineInputSchema).default([]),
});

// POST /api/v1/tours/:id/settlement/preview
// Read-only: shows the entitlement caps and the resulting net position
// before the employee commits to a submission.
settlementRouter.post("/tours/:id/settlement/preview", (req, res) => {
  const { lines } = previewSchema.parse(req.body);
  const record = store.tourRequests.get(req.params.id);
  if (!record) throw new ApiError(404, "NOT_FOUND", "Tour request not found.");

  const isOwner = record.personNumber === req.user!.personNumber;
  const isAuthority =
    record.authorities.approving?.personNumber === req.user!.personNumber ||
    record.authorities.forwarding?.personNumber === req.user!.personNumber ||
    record.authorities.recommending?.personNumber === req.user!.personNumber;
  if (!isOwner && !isAuthority && !req.user!.roles.includes("HR_ADMIN")) {
    throw new ApiError(403, "FORBIDDEN", "You are not authorized to view this settlement.");
  }

  res.json({ data: settlement.previewSettlement(record, lines) });
});

// POST /api/v1/tours/:id/settlement — employee submits the bill (§11).
settlementRouter.post("/tours/:id/settlement", (req, res) => {
  const input = settlementSubmitSchema.parse(req.body);
  res.json({ data: settlement.submitSettlement(req.user!, req.params.id, input) });
});

// POST /api/v1/tours/:id/settlement/decision — Approving Authority decides.
settlementRouter.post("/tours/:id/settlement/decision", requireRole("APPROVING"), (req, res) => {
  const input = settlementDecisionSchema.parse(req.body);
  res.json({ data: settlement.decideSettlement(req.user!, req.params.id, input) });
});
