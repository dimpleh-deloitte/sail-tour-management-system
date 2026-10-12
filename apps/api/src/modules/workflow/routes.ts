import { Router } from "express";
import { z } from "zod";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { WorklistStatusFilter } from "../../types.js";
import * as workflowService from "./service.js";
import { workflowActionSchema } from "../tours/dto.js";

export const workflowRouter = Router();
workflowRouter.use(requireAuth);

function parseStatusFilter(q: unknown): WorklistStatusFilter | undefined {
  if (q === "Pending" || q === "Approved" || q === "Rejected") return q;
  return undefined;
}

// GET /api/v1/worklists/forwarding
workflowRouter.get("/worklists/forwarding", requireRole("FORWARDING"), (req, res) => {
  res.json({ data: workflowService.forwardingWorklist(req.user!, parseStatusFilter(req.query.status)) });
});

// GET /api/v1/worklists/recommendation
workflowRouter.get("/worklists/recommendation", requireRole("RECOMMENDING"), (req, res) => {
  res.json({ data: workflowService.recommendationWorklist(req.user!, parseStatusFilter(req.query.status)) });
});

// GET /api/v1/worklists/approval
workflowRouter.get("/worklists/approval", requireRole("APPROVING"), (req, res) => {
  res.json({ data: workflowService.approvalWorklist(req.user!, parseStatusFilter(req.query.status)) });
});

const actionSchema = workflowActionSchema;
type ActionInput = z.infer<typeof actionSchema>;
function parseAction(req: { body: unknown }): ActionInput {
  return actionSchema.parse(req.body);
}

workflowRouter.post("/tours/:id/forward", requireRole("FORWARDING"), (req, res) => {
  const { expectedVersion, remarks, advanceAmounts, edits } = parseAction(req);
  res.json({ data: workflowService.forward(req.user!, req.params.id, expectedVersion, remarks ?? null, advanceAmounts, edits) });
});

workflowRouter.post("/tours/:id/recommend", requireRole("RECOMMENDING"), (req, res) => {
  const { expectedVersion, remarks, advanceAmounts, edits } = parseAction(req);
  res.json({ data: workflowService.recommend(req.user!, req.params.id, expectedVersion, remarks ?? null, advanceAmounts, edits) });
});

workflowRouter.post("/tours/:id/approve", requireRole("APPROVING"), (req, res) => {
  const { expectedVersion, remarks, advanceAmounts, edits } = parseAction(req);
  res.json({ data: workflowService.approve(req.user!, req.params.id, expectedVersion, remarks ?? null, advanceAmounts, edits) });
});

workflowRouter.post(
  "/tours/:id/reject",
  requireRole("FORWARDING", "RECOMMENDING", "APPROVING"),
  (req, res) => {
    const { expectedVersion, remarks } = parseAction(req);
    res.json({ data: workflowService.reject(req.user!, req.params.id, expectedVersion, remarks ?? null) });
  }
);
