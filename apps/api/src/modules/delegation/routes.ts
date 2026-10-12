// Acting-authority delegation endpoints (client requirement 6).
import { Router } from "express";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { delegationCreateSchema } from "../tours/dto.js";
import * as delegation from "./service.js";

export const delegationRouter = Router();
delegationRouter.use(requireAuth);

// GET /api/v1/delegations — delegations this user has given or received.
delegationRouter.get("/delegations", (req, res) => {
  res.json({ data: delegation.listMine(req.user!) });
});

// GET /api/v1/admin/delegations — every delegation, for HR Admin oversight.
delegationRouter.get("/admin/delegations", requireRole("HR_ADMIN"), (_req, res) => {
  res.json({ data: delegation.listAll() });
});

// POST /api/v1/delegations — nominate an acting authority for a date range.
delegationRouter.post("/delegations", (req, res) => {
  const input = delegationCreateSchema.parse(req.body);
  res.status(201).json({ data: delegation.create(req.user!, input) });
});

// POST /api/v1/delegations/:id/revoke
delegationRouter.post("/delegations/:id/revoke", (req, res) => {
  res.json({ data: delegation.revoke(req.user!, req.params.id) });
});
