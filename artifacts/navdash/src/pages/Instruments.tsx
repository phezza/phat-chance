import { useSK } from "@/lib/SignalKContext";
import { mpsToKnots, radToDeg, metersToFeet } from "@/lib/signalk";
import { GaugeRing } from "@/components/GaugeRing";
import { DataTile } from "@/components/DataTile";

function fmt(val: number | undefined, decimals = 1): string {
  if (val == null || !Number.isFinite(val)) return "--";
  return val.toFixed(decimals);
}

export function Instruments() {
  const { nav } = useSK();

  const sog = nav.speedOverGround != null ? mpsToKnots(nav.speedOverGround) : undefined;
  const stw = nav.speedThroughWater != null ? mpsToKnots(nav.speedThroughWater) : undefined;
  const hdg = nav.headingMagnetic != null ? radToDeg(nav.headingMagnetic) : nav.headingTrue != null ? radToDeg(nav.headingTrue) : undefined;
  const aws = nav.windSpeedApparent != null ? mpsToKnots(nav.windSpeedApparent) : undefined;
  const tws = nav.windSpeedTrue != null ? mpsToKnots(nav.windSpeedTrue) : undefined;
  const awa = nav.windAngleApparent != null ? radToDeg(nav.windAngleApparent) : undefined;
  const depth = nav.depthBelowKeel ?? nav.depthBelowSurface;
  const depthFt = depth != null ? metersToFeet(depth) : undefined;
  const waterTempC = nav.waterTemperature != null ? nav.waterTemperature - 273.15 : undefined;

  const instruments = [
    {
      title: "Speed Over Ground",
      gauge: { value: sog ?? 0, min: 0, max: 20, unit: "kn", label: "SOG", color: "#22d3ee" },
    },
    {
      title: "Speed Thru Water",
      gauge: { value: stw ?? 0, min: 0, max: 20, unit: "kn", label: "STW", color: "#a78bfa" },
    },
    {
      title: "Apparent Wind Speed",
      gauge: { value: aws ?? 0, min: 0, max: 50, unit: "kn", label: "AWS", color: "#22d3ee" },
    },
    {
      title: "True Wind Speed",
      gauge: { value: tws ?? 0, min: 0, max: 50, unit: "kn", label: "TWS", color: "rgba(34,211,238,0.6)" },
    },
    {
      title: "Depth",
      gauge: { value: depth ?? 0, min: 0, max: 50, unit: "m", label: "DEPTH", color: depth != null && depth < 3 ? "#ef4444" : "#22d3ee" },
    },
    {
      title: "Water Temp",
      gauge: { value: waterTempC ?? 0, min: 0, max: 35, unit: "°C", label: "TEMP", color: "#f59e0b" },
    },
  ];

  return (
    <div className="flex flex-col gap-4 p-4" data-testid="instruments-page">
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
        {instruments.map(({ title, gauge }) => (
          <div key={title} className="bg-white/5 border border-white/10 rounded-2xl p-4 flex flex-col items-center">
            <p className="text-white/40 uppercase tracking-widest text-xs mb-3 font-medium text-center leading-tight">{title}</p>
            <GaugeRing {...gauge} size={130} />
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-2">
        <DataTile
          label="Heading"
          value={hdg != null ? Math.round(((hdg % 360) + 360) % 360).toString() : "--"}
          unit="°"
          size="md"
          color="#22d3ee"
          subValue={nav.headingMagnetic != null ? "Magnetic" : "True"}
        />
        <DataTile
          label="Apparent Wind Angle"
          value={awa != null ? fmt(awa, 0) : "--"}
          unit="°"
          size="md"
          color="#22d3ee"
          subValue={awa != null ? (awa > 180 ? `${(360 - awa).toFixed(0)}° Port` : `${awa.toFixed(0)}° Stbd`) : undefined}
        />
        <DataTile
          label="Depth (ft)"
          value={depthFt != null ? fmt(depthFt, 0) : "--"}
          unit="ft"
          size="md"
          color={depth != null && depth < 3 ? "#ef4444" : "#22d3ee"}
        />
        <DataTile
          label="Autopilot"
          value={nav.autopilotState ?? "--"}
          size="md"
          color={nav.autopilotState === "auto" ? "#22d3ee" : nav.autopilotState === "standby" ? "#f59e0b" : "rgba(255,255,255,0.3)"}
          subValue={nav.autopilotTargetHeading != null ? `Target: ${radToDeg(nav.autopilotTargetHeading).toFixed(0)}°` : undefined}
        />
      </div>
    </div>
  );
}
