// HR Admin module — SSoT §25: exact HR Admin powers/overrides are TBD.
// This is a minimal, honest monitoring surface (all requests, read-only)
// rather than an invented set of admin superpowers.
import { Router } from "express";
import { z } from "zod";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { store } from "../../repository/store.js";
import { listAudit, recordAudit } from "../audit/service.js";
import { HEADQUARTERS } from "../reference-data/lov.js";
import { ApiError } from "../../middleware/error-handler.js";

export const adminRouter = Router();
adminRouter.use(requireAuth, requireRole("HR_ADMIN"));

// GET /api/v1/admin/tours — cross-request monitoring (SSoT §4/§14)
adminRouter.get("/admin/tours", (_req, res) => {
  const all = [...store.tourRequests.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  res.json({ data: all });
});

// GET /api/v1/admin/audit — SSoT §22 audit visibility
adminRouter.get("/admin/audit", (_req, res) => {
  res.json({ data: listAudit() });
});

// --- HQ -> destination distance matrix (§6(c), client requirement 7) ------
// The 500km air/special-approval decision rests on these figures, so they
// are maintained reference data with an audit trail, not a free-text field
// on the request. The matrix ships empty — see repository/seed-distances.ts.

// GET /api/v1/admin/distances — current matrix, plus coverage against the
// full headquarters x destination grid so gaps are visible.
adminRouter.get("/admin/distances", (_req, res) => {
  const rows = [...store.distances.values()].sort(
    (a, b) => a.headquarter.localeCompare(b.headquarter) || a.destCode.localeCompare(b.destCode)
  );
  const activeDestinations = store.destinations.filter((d) => d.activeFlag === "Y").length;
  res.json({
    data: {
      rows,
      coverage: {
        recorded: rows.length,
        possiblePairs: HEADQUARTERS.length * activeDestinations,
        headquarters: HEADQUARTERS.length,
        activeDestinations,
      },
    },
  });
});

const distanceUpsertSchema = z.object({
  headquarter: z.enum(HEADQUARTERS as unknown as [string, ...string[]]),
  destCode: z.string().min(1),
  // A zero-kilometre pair would mean the destination is the headquarters,
  // which is not a tour at all under §4.1.
  distanceKm: z.number().positive("Distance must be greater than zero."),
  sourceRef: z.string().min(1, "Record where this distance came from.").max(200),
});

const distanceBulkSchema = z.object({
  rows: z.array(distanceUpsertSchema).min(1).max(5000),
});

// PUT /api/v1/admin/distances — upsert one or many pairs.
adminRouter.put("/admin/distances", (req, res) => {
  const { rows } = distanceBulkSchema.parse(req.body);

  // Validate every row before writing any, so a bad row in a bulk load does
  // not leave the matrix half-updated.
  for (const row of rows) {
    const dest = store.destinations.find((d) => d.destCode === row.destCode);
    if (!dest) {
      throw new ApiError(400, "VALIDATION_ERROR", `Unknown destination code "${row.destCode}".`, {
        destCode: "Destination must exist in the destination master.",
      });
    }
  }

  for (const row of rows) {
    store.upsertDistance(row);
  }

  recordAudit({
    eventType: "DISTANCE_MATRIX_UPDATED",
    entityType: "DISTANCE_MATRIX",
    entityId: rows.length === 1 ? `${rows[0].headquarter}|${rows[0].destCode}` : "BULK",
    actorPersonNumber: req.user!.personNumber,
    actorRole: "HR_ADMIN",
    detail: { rowCount: rows.length },
    correlationId: null,
  });

  res.json({ data: { updated: rows.length } });
});
