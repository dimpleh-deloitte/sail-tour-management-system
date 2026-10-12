// Attachments — SSoT §10: max 3 per request, jpeg/jpg/png/bmp/pdf only,
// validated server-side by content, not just extension/browser MIME type.
// Storage mechanism is TBD (SSoT §25); this reference implementation keeps
// bytes in memory (mirrors "DB BLOB" mode in the Oracle schema) behind the
// same route contract a real object-store-backed implementation would use.
import { Router } from "express";
import multer from "multer";
import { fileTypeFromBuffer } from "file-type";
import { requireAuth } from "../../middleware/auth.js";
import { env } from "../../config/env.js";
import { store } from "../../repository/store.js";
import { ApiError } from "../../middleware/error-handler.js";
import { recordAudit } from "../audit/service.js";

export const attachmentsRouter = Router();
attachmentsRouter.use(requireAuth);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: env.attachments.maxFileSizeMb * 1024 * 1024 },
});

const attachmentContents = new Map<string, Buffer>();

const EXT_BY_DETECTED_TYPE: Record<string, string> = {
  jpg: "jpeg",
  jpeg: "jpeg",
  png: "png",
  bmp: "bmp",
  pdf: "pdf",
};

// POST /api/v1/tours/:id/attachments
attachmentsRouter.post("/tours/:id/attachments", upload.single("file"), async (req, res) => {
  const record = store.tourRequests.get(req.params.id);
  if (!record) throw new ApiError(404, "NOT_FOUND", "Tour request not found.");
  if (record.personNumber !== req.user!.personNumber) {
    throw new ApiError(403, "FORBIDDEN", "Only the owning employee may attach files.");
  }
  if (record.status !== "DRAFT") {
    throw new ApiError(409, "NOT_EDITABLE", "Attachments can only be added while the request is a draft.");
  }
  if (!req.file) {
    throw new ApiError(400, "VALIDATION_ERROR", "No file uploaded.");
  }
  if (record.attachments.length >= env.attachments.maxCount) {
    // VAL-08 — re-verified here under the "lock" of this single-threaded
    // in-memory store, closing the race the DDL comment describes for the
    // real Oracle-backed implementation.
    throw new ApiError(400, "VALIDATION_ERROR", `Maximum ${env.attachments.maxCount} attachments allowed.`);
  }

  const attachmentName = String(req.body.attachmentName ?? req.file.originalname).slice(0, 200);

  // Detect the real file type from content — do not trust the extension or
  // the browser-supplied MIME type alone (SSoT §22).
  const detected = await fileTypeFromBuffer(req.file.buffer);
  const detectedExt = detected ? EXT_BY_DETECTED_TYPE[detected.ext] : undefined;
  if (!detectedExt || !env.attachments.allowedExtensions.includes(detectedExt)) {
    throw new ApiError(
      400,
      "VALIDATION_ERROR",
      "Upload only jpeg/jpg/png/bmp/pdf format." // SSoT §10 current-system text, reused verbatim
    );
  }

  const attachmentId = store.newId();
  attachmentContents.set(attachmentId, req.file.buffer);
  record.attachments.push({
    attachmentId,
    attachmentName,
    fileName: req.file.originalname,
    fileExtension: detectedExt,
    mimeType: detected!.mime,
    fileSizeBytes: req.file.size,
    uploadedBy: req.user!.personNumber,
    uploadedAt: new Date().toISOString(),
  });
  record.updatedAt = new Date().toISOString();

  recordAudit({
    eventType: "ATTACHMENT_UPLOADED",
    entityType: "TOUR_ATTACHMENT",
    entityId: attachmentId,
    actorPersonNumber: req.user!.personNumber,
    actorRole: "EMPLOYEE",
    detail: { requestId: record.requestId, fileName: req.file.originalname },
    correlationId: null,
  });

  res.status(201).json({ data: record.attachments[record.attachments.length - 1] });
});

// GET /api/v1/tours/:id/attachments/:attachmentId — secure retrieval by authorized users only
attachmentsRouter.get("/tours/:id/attachments/:attachmentId", (req, res) => {
  const record = store.tourRequests.get(req.params.id);
  if (!record) throw new ApiError(404, "NOT_FOUND", "Tour request not found.");

  const isOwner = record.personNumber === req.user!.personNumber;
  const isAssignedAuthority = [
    record.authorities.forwarding?.personNumber,
    record.authorities.recommending?.personNumber,
    record.authorities.approving?.personNumber,
  ].includes(req.user!.personNumber);
  const isHrAdmin = req.user!.roles.includes("HR_ADMIN");
  if (!isOwner && !isAssignedAuthority && !isHrAdmin) {
    throw new ApiError(403, "FORBIDDEN", "Not authorized to view this attachment.");
  }

  const meta = record.attachments.find((a) => a.attachmentId === req.params.attachmentId);
  const content = attachmentContents.get(req.params.attachmentId);
  if (!meta || !content) throw new ApiError(404, "NOT_FOUND", "Attachment not found.");

  res.setHeader("Content-Type", meta.mimeType);
  res.setHeader("Content-Disposition", `inline; filename="${meta.fileName}"`);
  res.send(content);
});
