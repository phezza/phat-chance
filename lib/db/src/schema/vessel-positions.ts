import { pgTable, text, doublePrecision, timestamp, integer, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const vesselPositionsTable = pgTable(
  "vessel_positions",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    vesselId: text("vessel_id").notNull(),
    recordedAt: timestamp("recorded_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    latitude: doublePrecision("latitude").notNull(),
    longitude: doublePrecision("longitude").notNull(),
    speedOverGround: doublePrecision("speed_over_ground"),
    courseOverGround: doublePrecision("course_over_ground"),
    headingTrue: doublePrecision("heading_true"),
    headingMagnetic: doublePrecision("heading_magnetic"),
    depth: doublePrecision("depth"),
    waterTemperature: doublePrecision("water_temperature"),
    windSpeedTrue: doublePrecision("wind_speed_true"),
    windAngleTrue: doublePrecision("wind_angle_true"),
    windSpeedApparent: doublePrecision("wind_speed_apparent"),
    windAngleApparent: doublePrecision("wind_angle_apparent"),
    note: text("note"),
  },
  (t) => [
    index("vessel_positions_vessel_recorded_idx").on(t.vesselId, t.recordedAt),
  ],
);

export const insertVesselPositionSchema = createInsertSchema(vesselPositionsTable).omit({
  recordedAt: true,
});
export type InsertVesselPosition = z.infer<typeof insertVesselPositionSchema>;
export type VesselPosition = typeof vesselPositionsTable.$inferSelect;
