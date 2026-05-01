import { Router, type IRouter } from "express";
import healthRouter from "./health";
import trackRouter from "./track";
import { logger } from "../lib/logger";

const router: IRouter = Router();

router.use(healthRouter);

if (process.env["DATABASE_URL"]) {
  router.use(trackRouter);
  logger.info("Tracking routes enabled");
} else {
  logger.info("DATABASE_URL not set; tracking routes disabled (boat-side mode)");
  router.all("/track/*splat", (_req, res) => {
    res.status(503).json({ error: "Tracking is disabled on this server (no DATABASE_URL)" });
  });
}

export default router;
