import { Router } from "express";
import { z } from "zod";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { tourInputSchema } from "./dto.js";
import * as toursService from "./service.js";

export const toursRouter = Router();

toursRouter.use(requireAuth);

// POST /api/v1/tours — create draft (SSoT §19)
toursRouter.post("/tours", requireRole("EMPLOYEE"), (req, res) => {
  const input = tourInputSchema.parse(req.body);
  const record = toursService.createDraft(req.user!, input);
  res.status(201).json({ data: record });
});

// GET /api/v1/tours/mine — employee worklist (SSoT §14)
toursRouter.get("/tours/mine", (req, res) => {
  res.json({ data: toursService.listMine(req.user!) });
});

// GET /api/v1/tours/:id — read authorized request
toursRouter.get("/tours/:id", (req, res) => {
  res.json({ data: toursService.getById(req.user!, req.params.id) });
});

// PUT /api/v1/tours/:id — edit permitted draft
const updateSchema = tourInputSchema.extend({ expectedVersion: z.number().int().positive() });
toursRouter.put("/tours/:id", requireRole("EMPLOYEE"), (req, res) => {
  const { expectedVersion, ...input } = updateSchema.parse(req.body);
  const record = toursService.updateDraft(req.user!, req.params.id, input, expectedVersion);
  res.json({ data: record });
});

// POST /api/v1/tours/:id/submit — validate + submit + start workflow
const submitSchema = z.object({ expectedVersion: z.number().int().positive() });
toursRouter.post("/tours/:id/submit", requireRole("EMPLOYEE"), (req, res) => {
  const { expectedVersion } = submitSchema.parse(req.body);
  const record = toursService.submit(req.user!, req.params.id, expectedVersion);
  res.json({ data: record });
});
