import type { NavigationData, AISTarget } from "./signalk";

export interface CPAResult {
  distanceMeters: number;
  bearingDeg: number;
  cpaMeters: number;
  tcpaSeconds: number;
  relativeSpeedMps: number;
}

export type ThreatLevel = "none" | "info" | "caution" | "warning" | "danger";

export interface ThreatStyle {
  level: ThreatLevel;
  color: string;
  label: string;
}

const NONE_STYLE: ThreatStyle = { level: "none", color: "transparent", label: "" };
const INFO_STYLE: ThreatStyle = { level: "info", color: "#94a3b8", label: "Tracked" };
const CAUTION_STYLE: ThreatStyle = { level: "caution", color: "#facc15", label: "Caution" };
const WARNING_STYLE: ThreatStyle = { level: "warning", color: "#f97316", label: "Warning" };
const DANGER_STYLE: ThreatStyle = { level: "danger", color: "#ef4444", label: "Danger" };

export function computeCPA(
  ownLat: number,
  ownLon: number,
  ownSogMps: number,
  ownCogRad: number,
  tgtLat: number,
  tgtLon: number,
  tgtSogMps: number,
  tgtCogRad: number,
): CPAResult {
  const cosLat = Math.cos((ownLat * Math.PI) / 180);
  const dx = (tgtLon - ownLon) * cosLat * 111319.9;
  const dy = (tgtLat - ownLat) * 111319.9;
  const distance = Math.hypot(dx, dy);
  const bearing = (((Math.atan2(dx, dy) * 180) / Math.PI) % 360 + 360) % 360;

  const ownVx = ownSogMps * Math.sin(ownCogRad);
  const ownVy = ownSogMps * Math.cos(ownCogRad);
  const tgtVx = tgtSogMps * Math.sin(tgtCogRad);
  const tgtVy = tgtSogMps * Math.cos(tgtCogRad);
  const dvx = tgtVx - ownVx;
  const dvy = tgtVy - ownVy;
  const v2 = dvx * dvx + dvy * dvy;

  let tcpa = 0;
  let cpa = distance;
  if (v2 > 1e-6) {
    tcpa = -(dx * dvx + dy * dvy) / v2;
    const cdx = dx + dvx * tcpa;
    const cdy = dy + dvy * tcpa;
    cpa = Math.hypot(cdx, cdy);
  }

  return {
    distanceMeters: distance,
    bearingDeg: bearing,
    cpaMeters: cpa,
    tcpaSeconds: tcpa,
    relativeSpeedMps: Math.sqrt(v2),
  };
}

export function classifyThreat(r: CPAResult): ThreatStyle {
  // Already past CPA, or way out
  if (r.tcpaSeconds < -60) return NONE_STYLE;
  if (r.tcpaSeconds > 60 * 60) return INFO_STYLE;
  const cpaNm = r.cpaMeters / 1852;
  // Already very close right now → at minimum caution
  if (r.distanceMeters < 500) {
    if (cpaNm < 0.25) return DANGER_STYLE;
    if (cpaNm < 0.5) return WARNING_STYLE;
    return CAUTION_STYLE;
  }
  if (r.tcpaSeconds < 0) return INFO_STYLE;
  if (cpaNm < 0.25 && r.tcpaSeconds < 20 * 60) return DANGER_STYLE;
  if (cpaNm < 0.5 && r.tcpaSeconds < 30 * 60) return WARNING_STYLE;
  if (cpaNm < 1.0 && r.tcpaSeconds < 60 * 60) return CAUTION_STYLE;
  return INFO_STYLE;
}

export function tryComputeCPAForTarget(
  nav: NavigationData,
  target: AISTarget,
): CPAResult | null {
  if (!nav.position || nav.speedOverGround == null) return null;
  if (!target.position || target.sog == null) return null;
  const ownCog = nav.courseOverGroundTrue ?? nav.headingTrue ?? nav.headingMagnetic;
  if (ownCog == null) return null;
  const tgtCog = target.cog ?? target.heading;
  if (tgtCog == null) return null;
  return computeCPA(
    nav.position.latitude,
    nav.position.longitude,
    nav.speedOverGround,
    ownCog,
    target.position.latitude,
    target.position.longitude,
    target.sog,
    tgtCog,
  );
}

export function fmtTcpa(seconds: number): string {
  if (!Number.isFinite(seconds)) return "—";
  if (seconds < 0) return "past";
  if (seconds < 60) return `${Math.round(seconds)}s`;
  if (seconds < 3600) {
    const m = Math.floor(seconds / 60);
    const s = Math.round(seconds % 60);
    return `${m}m ${s.toString().padStart(2, "0")}s`;
  }
  const h = Math.floor(seconds / 3600);
  const m = Math.round((seconds % 3600) / 60);
  return `${h}h ${m.toString().padStart(2, "0")}m`;
}

export function fmtNm(meters: number): string {
  if (!Number.isFinite(meters)) return "—";
  if (meters < 200) return `${Math.round(meters)} m`;
  return `${(meters / 1852).toFixed(2)} NM`;
}
