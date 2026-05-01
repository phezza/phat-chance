import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { and, desc, eq, gte, asc } from "drizzle-orm";
import {
  PostTrackPositionBody,
  GetTrackHistoryQueryParams,
} from "@workspace/api-zod";
import { db, vesselPositionsTable } from "@workspace/db";

const router: IRouter = Router();

function requireBearerToken(req: Request, res: Response, next: NextFunction) {
  const expected = process.env["TRACK_WRITE_TOKEN"];
  if (!expected) {
    req.log.warn("TRACK_WRITE_TOKEN is not set; refusing all writes");
    res.status(503).json({ error: "Tracking write disabled (no token configured on server)" });
    return;
  }
  const auth = req.header("authorization") ?? "";
  const match = auth.match(/^Bearer\s+(.+)$/i);
  if (!match || match[1].trim() !== expected) {
    res.status(401).json({ error: "Invalid or missing bearer token" });
    return;
  }
  next();
}

function serialise(row: typeof vesselPositionsTable.$inferSelect) {
  return {
    id: row.id,
    vesselId: row.vesselId,
    recordedAt: row.recordedAt.toISOString(),
    latitude: row.latitude,
    longitude: row.longitude,
    speedOverGround: row.speedOverGround ?? undefined,
    courseOverGround: row.courseOverGround ?? undefined,
    headingTrue: row.headingTrue ?? undefined,
    headingMagnetic: row.headingMagnetic ?? undefined,
    depth: row.depth ?? undefined,
    waterTemperature: row.waterTemperature ?? undefined,
    windSpeedTrue: row.windSpeedTrue ?? undefined,
    windAngleTrue: row.windAngleTrue ?? undefined,
    windSpeedApparent: row.windSpeedApparent ?? undefined,
    windAngleApparent: row.windAngleApparent ?? undefined,
    note: row.note ?? undefined,
  };
}

router.post("/track/:vesselId", requireBearerToken, async (req, res) => {
  const vesselId = String(req.params.vesselId).trim();
  if (!vesselId) {
    res.status(400).json({ error: "Missing vesselId" });
    return;
  }
  const parsed = PostTrackPositionBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid body", details: parsed.error.issues });
    return;
  }
  const data = parsed.data;
  try {
    const [inserted] = await db
      .insert(vesselPositionsTable)
      .values({
        vesselId,
        latitude: data.latitude,
        longitude: data.longitude,
        speedOverGround: data.speedOverGround ?? null,
        courseOverGround: data.courseOverGround ?? null,
        headingTrue: data.headingTrue ?? null,
        headingMagnetic: data.headingMagnetic ?? null,
        depth: data.depth ?? null,
        waterTemperature: data.waterTemperature ?? null,
        windSpeedTrue: data.windSpeedTrue ?? null,
        windAngleTrue: data.windAngleTrue ?? null,
        windSpeedApparent: data.windSpeedApparent ?? null,
        windAngleApparent: data.windAngleApparent ?? null,
        note: data.note ?? null,
      })
      .returning();
    res.status(201).json(serialise(inserted));
  } catch (err) {
    req.log.error({ err }, "Failed to insert vessel position");
    res.status(500).json({ error: "Failed to store position" });
  }
});

router.get("/track/:vesselId/latest", async (req, res) => {
  const vesselId = String(req.params.vesselId).trim();
  try {
    const rows = await db
      .select()
      .from(vesselPositionsTable)
      .where(eq(vesselPositionsTable.vesselId, vesselId))
      .orderBy(desc(vesselPositionsTable.recordedAt))
      .limit(1);
    if (rows.length === 0) {
      res.status(404).json({ error: "No data for this vessel" });
      return;
    }
    res.json(serialise(rows[0]));
  } catch (err) {
    req.log.error({ err }, "Failed to fetch latest position");
    res.status(500).json({ error: "Failed to read latest position" });
  }
});

router.get("/track/:vesselId/history", async (req, res) => {
  const vesselId = String(req.params.vesselId).trim();
  const parsed = GetTrackHistoryQueryParams.safeParse({
    sinceMinutes: req.query.sinceMinutes ? Number(req.query.sinceMinutes) : undefined,
    limit: req.query.limit ? Number(req.query.limit) : undefined,
  });
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid query", details: parsed.error.issues });
    return;
  }
  const sinceMinutes = parsed.data.sinceMinutes ?? 720;
  const limit = parsed.data.limit ?? 1000;
  const since = new Date(Date.now() - sinceMinutes * 60_000);
  try {
    const rows = await db
      .select()
      .from(vesselPositionsTable)
      .where(
        and(
          eq(vesselPositionsTable.vesselId, vesselId),
          gte(vesselPositionsTable.recordedAt, since),
        ),
      )
      .orderBy(asc(vesselPositionsTable.recordedAt))
      .limit(limit);
    res.json(rows.map(serialise));
  } catch (err) {
    req.log.error({ err }, "Failed to fetch position history");
    res.status(500).json({ error: "Failed to read history" });
  }
});

export default router;
