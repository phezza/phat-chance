import { useSK } from "@/lib/SignalKContext";
import { mpsToKnots, radToDeg, formatDeg, formatLatLon } from "@/lib/signalk";
import { DataTile } from "@/components/DataTile";
import { CompassRose } from "@/components/CompassRose";
import { GaugeRing } from "@/components/GaugeRing";
import { WindRose } from "@/components/WindRose";
import { PageHeader } from "@/components/PageHeader";
import { LayoutDashboard } from "lucide-react";

function fmt(val: number | undefined, decimals = 1, fallback = "--"): string {
  if (val == null || !Number.isFinite(val)) return fallback;
  return val.toFixed(decimals);
}

export function Dashboard() {
  const { nav } = useSK();

  const sog = nav.speedOverGround != null ? mpsToKnots(nav.speedOverGround) : undefined;
  const stw = nav.speedThroughWater != null ? mpsToKnots(nav.speedThroughWater) : undefined;
  const hdg = nav.headingMagnetic != null ? radToDeg(nav.headingMagnetic) : nav.headingTrue != null ? radToDeg(nav.headingTrue) : undefined;
  const cog = nav.courseOverGroundTrue != null ? radToDeg(nav.courseOverGroundTrue) : undefined;
  const windSpeedApparent = nav.windSpeedApparent != null ? mpsToKnots(nav.windSpeedApparent) : undefined;
  const windSpeedTrue = nav.windSpeedTrue != null ? mpsToKnots(nav.windSpeedTrue) : undefined;
  const windAngleApparent = nav.windAngleApparent != null ? radToDeg(nav.windAngleApparent) : undefined;
  const windAngleTrue = nav.windAngleTrue != null ? radToDeg(nav.windAngleTrue) : undefined;
  const depth = nav.depthBelowKeel ?? nav.depthBelowSurface;

  return (
    <div className="flex flex-col h-full" data-testid="dashboard-page">
      <PageHeader title="Dashboard" icon={LayoutDashboard} />
      <div className="flex flex-col gap-4 p-4 flex-1 min-h-0">
      <div className="grid grid-cols-12 gap-4 flex-1">
        <div className="col-span-12 lg:col-span-4 flex flex-col gap-4">
          <div className="flex flex-col items-center justify-center bg-white/5 border border-white/10 rounded-2xl p-4">
            <p className="text-white/40 uppercase tracking-widest text-xs mb-3 font-medium">Compass</p>
            <CompassRose
              heading={hdg ?? 0}
              size={220}
              showWindDir={windAngleApparent != null}
              windAngle={windAngleApparent}
              windSpeed={windSpeedApparent}
              label={nav.headingMagnetic != null ? "MAG" : "TRUE"}
            />
            <div className="mt-3 grid grid-cols-2 gap-3 w-full">
              <DataTile
                label="Heading"
                value={hdg != null ? Math.round(((hdg % 360) + 360) % 360).toString() : "--"}
                unit="°"
                size="sm"
                color="#22d3ee"
                subValue={nav.headingMagnetic != null ? "Magnetic" : "True"}
              />
              <DataTile
                label="COG"
                value={cog != null ? Math.round(((cog % 360) + 360) % 360).toString() : "--"}
                unit="°"
                size="sm"
                color="#a78bfa"
                subValue="True"
              />
            </div>
          </div>

          <div className="flex flex-col items-center justify-center bg-white/5 border border-white/10 rounded-2xl p-4">
            <p className="text-white/40 uppercase tracking-widest text-xs mb-3 font-medium">Autopilot</p>
            <div
              className="w-full rounded-xl p-3 border text-center"
              style={{
                borderColor: nav.autopilotState === "auto" ? "rgba(34,211,238,0.4)" : "rgba(255,255,255,0.1)",
                background: nav.autopilotState === "auto" ? "rgba(34,211,238,0.08)" : "transparent",
              }}
              data-testid="autopilot-status"
            >
              <div
                className="text-2xl font-bold uppercase tracking-widest font-mono"
                style={{ color: nav.autopilotState === "auto" ? "#22d3ee" : nav.autopilotState === "standby" ? "#f59e0b" : "rgba(255,255,255,0.3)" }}
              >
                {nav.autopilotState ?? "N/A"}
              </div>
              {nav.autopilotTargetHeading != null && (
                <div className="text-white/40 text-sm mt-1">
                  Target: {fmt(radToDeg(nav.autopilotTargetHeading), 0)}°
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="col-span-12 lg:col-span-4 flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col items-center justify-center bg-white/5 border border-white/10 rounded-2xl p-4">
              <p className="text-white/40 uppercase tracking-widest text-xs mb-2 font-medium">Speed (SOG)</p>
              <GaugeRing
                value={sog ?? 0}
                min={0}
                max={20}
                unit="kn"
                label="SOG"
                size={150}
                color="#22d3ee"
              />
            </div>
            <div className="flex flex-col items-center justify-center bg-white/5 border border-white/10 rounded-2xl p-4">
              <p className="text-white/40 uppercase tracking-widest text-xs mb-2 font-medium">Speed (STW)</p>
              <GaugeRing
                value={stw ?? 0}
                min={0}
                max={20}
                unit="kn"
                label="STW"
                size={150}
                color="#a78bfa"
              />
            </div>
          </div>

          <div className="flex flex-col items-center justify-center bg-white/5 border border-white/10 rounded-2xl p-4">
            <p className="text-white/40 uppercase tracking-widest text-xs mb-3 font-medium">Wind</p>
            <WindRose
              apparentAngle={windAngleApparent}
              apparentSpeed={windSpeedApparent}
              trueAngle={windAngleTrue}
              trueSpeed={windSpeedTrue}
              size={180}
            />
            <div className="mt-3 grid grid-cols-2 gap-3 w-full">
              <DataTile
                label="Apparent"
                value={fmt(windSpeedApparent)}
                unit="kn"
                size="sm"
                color="#22d3ee"
                subValue={windAngleApparent != null ? `${formatDeg(windAngleApparent)}` : undefined}
              />
              <DataTile
                label="True"
                value={fmt(windSpeedTrue)}
                unit="kn"
                size="sm"
                color="rgba(34,211,238,0.5)"
                subValue={windAngleTrue != null ? `${formatDeg(windAngleTrue)}` : undefined}
              />
            </div>
          </div>
        </div>

        <div className="col-span-12 lg:col-span-4 flex flex-col gap-4">
          <DataTile
            label="Position"
            value={nav.position ? formatLatLon(nav.position.latitude, nav.position.longitude) : "--"}
            size="sm"
            color="#22d3ee"
            className="font-mono"
          />

          <div className="grid grid-cols-2 gap-3">
            <DataTile
              label="Depth"
              value={depth != null ? fmt(depth) : "--"}
              unit="m"
              size="sm"
              color={depth != null && depth < 3 ? "#ef4444" : "#22d3ee"}
              subValue={depth != null && depth < 5 ? "Shallow!" : undefined}
            />
            <DataTile
              label="Water Temp"
              value={nav.waterTemperature != null ? fmt(nav.waterTemperature - 273.15) : "--"}
              unit="°C"
              size="sm"
              color="#f59e0b"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <DataTile
              label="Trip Log"
              value={nav.logTrip != null ? (nav.logTrip / 1852).toFixed(1) : "--"}
              unit="NM"
              size="sm"
              color="#a78bfa"
            />
            <DataTile
              label="Total Log"
              value={nav.logTotal != null ? (nav.logTotal / 1852).toFixed(0) : "--"}
              unit="NM"
              size="sm"
              color="#a78bfa"
            />
          </div>

          <div className="flex-1 flex flex-col gap-3">
            <DataTile
              label="SOG"
              value={fmt(sog)}
              unit="kn"
              size="md"
              color="#22d3ee"
              data-testid="tile-sog"
            />
            <DataTile
              label="VMG"
              value={cog != null && sog != null && hdg != null
                ? fmt(sog * Math.cos(((cog - hdg) * Math.PI) / 180))
                : "--"}
              unit="kn"
              size="md"
              color="#f59e0b"
            />
          </div>
        </div>
      </div>
      </div>
    </div>
  );
}
