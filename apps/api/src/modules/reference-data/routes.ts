import { Router } from "express";
import { store } from "../../repository/store.js";
import { HEADQUARTERS, TOUR_TYPES, ROAD_TRAVEL_PERMISSIONS, AIR_TRAVEL_PERMISSIONS, RAIL_TRAVEL_PERMISSIONS, ADVANCE_CATEGORIES } from "./lov.js";

export const referenceDataRouter = Router();

// GET /api/v1/destinations — SSoT §9: display DESTI_NAME, return DESTI_CODE.
referenceDataRouter.get("/destinations", (_req, res) => {
  const active = store.destinations.filter((d) => d.activeFlag === "Y");
  res.json({ data: active.map((d) => ({ code: d.destCode, label: d.destName })) });
});

// GET /api/v1/tour-types — SSoT §7 exact confirmed LOV.
referenceDataRouter.get("/tour-types", (_req, res) => {
  res.json({ data: TOUR_TYPES });
});

// GET /api/v1/headquarters — SSoT §6 exact confirmed LOV.
referenceDataRouter.get("/headquarters", (_req, res) => {
  res.json({ data: HEADQUARTERS });
});

referenceDataRouter.get("/travel-permissions", (_req, res) => {
  res.json({ data: { road: ROAD_TRAVEL_PERMISSIONS, air: AIR_TRAVEL_PERMISSIONS, rail: RAIL_TRAVEL_PERMISSIONS } });
});

// GET /api/v1/advance-categories — fixed four-row list confirmed by the
// client's current-system screenshot (see lov.ts comment).
referenceDataRouter.get("/advance-categories", (_req, res) => {
  res.json({ data: ADVANCE_CATEGORIES });
});
