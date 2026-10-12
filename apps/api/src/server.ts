import express from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import { env } from "./config/env.js";
import { requestId } from "./middleware/request-id.js";
import { attachUser } from "./middleware/auth.js";
import { errorHandler } from "./middleware/error-handler.js";
import { authRouter } from "./modules/auth/routes.js";
import { referenceDataRouter } from "./modules/reference-data/routes.js";
import { toursRouter } from "./modules/tours/routes.js";
import { workflowRouter } from "./modules/workflow/routes.js";
import { attachmentsRouter } from "./modules/attachments/routes.js";
import { taRulesRouter } from "./modules/ta-rules/routes.js";
import { adminRouter } from "./modules/admin/routes.js";
import { lifecycleRouter } from "./modules/lifecycle/routes.js";
import { settlementRouter } from "./modules/settlement/routes.js";
import { delegationRouter } from "./modules/delegation/routes.js";

const app = express();

app.use(helmet());
app.use(
  cors({
    origin: env.corsAllowedOrigins,
    credentials: true,
  })
);
app.use(express.json({ limit: "2mb" }));
app.use(cookieParser());
app.use(requestId);
app.use(attachUser);

app.get("/health", (_req, res) => res.json({ status: "ok", dataMode: env.dataMode }));

const api = express.Router();
api.use(authRouter);
api.use(referenceDataRouter);
api.use(toursRouter);
api.use(workflowRouter);
api.use(attachmentsRouter);
api.use(taRulesRouter);
// Post-approval lifecycle, settlement and delegation (client requirements
// 2, 3, 4, 6, 7 and 8 — Oct 2026).
api.use(lifecycleRouter);
api.use(settlementRouter);
api.use(delegationRouter);
api.use(adminRouter);

app.use(env.apiBasePath, api);

app.use(errorHandler);

app.listen(env.port, () => {
  // eslint-disable-next-line no-console
  console.log(`SAIL Tour Management API listening on http://localhost:${env.port} (dataMode=${env.dataMode})`);
  if (env.auth.useMockProvider) {
    // eslint-disable-next-line no-console
    console.log(`Mock auth enabled — POST ${env.apiBasePath}/auth/dev-login { "personNumber": "A000241" }`);
  }
});
