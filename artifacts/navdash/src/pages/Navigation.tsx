import { useSK } from "@/lib/SignalKContext";
import { mpsToKnots, radToDeg, formatLatLon } from "@/lib/signalk";
import { DataTile } from "@/components/DataTile";
import { CompassRose } from "@/components/CompassRose";
import { GaugeRing } from "@/components/GaugeRing";
import { PageHeader } from "@/components/PageHeader";
import { Compass } from "lucide-react";

function fmt(val: number | undefined, decimals = 1): string {
  if (val == null || !Number.isFinite(val)) return "--";
  return val.toFixed(decimals);
}

export function Navigation() {
  const { nav } = useSK();

  const sog = nav.speedOverGround != null ? mpsToKnots(nav.speedOverGround) : undefined;
  const stw = nav.speedThroughWater != null ? mpsToKnots(nav.speedThroughWater) : undefined;
  const hdgMag = nav.headingMagnetic != null ? radToDeg(nav.headingMagnetic) : undefined;
  const hdgTrue = nav.headingTrue != null ? radToDeg(nav.headingTrue) : undefined;
  const hdg = hdgMag ?? hdgTrue;
  const cog = nav.courseOverGroundTrue != null ? radToDeg(nav.courseOverGroundTrue) : undefined;
  const cogMag = nav.courseOverGroundMagnetic != null ? radToDeg(nav.courseOverGroundMagnetic) : undefined;
  const leeway = hdg != null && cog != null
    ? (((cog - hdg) % 360 + 540) % 360) - 180
    : undefined;
  const variation = nav.magneticVariation != null ? radToDeg(nav.magneticVariation) : undefined;
  const depth = nav.depthBelowKeel ?? nav.depthBelowSurface;

  return (
    <div className="flex flex-col" data-testid="navigation-page">
      <PageHeader title="Navigation" icon={Compass} />
      <div className="flex flex-col gap-4 p-4">
        <div className="grid grid-cols-12 gap-4">
          <div className="col-span-12 lg:col-span-4 flex flex-col items-center gap-4">
            <div className="w-full bg-white/5 border border-white/10 rounded-2xl p-6 flex flex-col items-center">
              <p className="text-white/40 uppercase tracking-widest text-xs mb-3 font-medium">Compass Rose</p>
              <CompassRose heading={hdg ?? 0} size={240} label={hdgMag != null ? "MAG" : "TRUE"} />
            </div>
          </div>

          <div className="col-span-12 lg:col-span-8 grid grid-cols-2 gap-4">
            <div className="bg-white/5 border border-white/10 rounded-2xl p-4 flex flex-col items-center">
              <p className="text-white/40 uppercase tracking-widest text-xs mb-2 font-medium">Speed Over Ground</p>
              <GaugeRing value={sog ?? 0} min={0} max={20} unit="kn" label="SOG" size={150} color="#22d3ee" />
            </div>
            <div className="bg-white/5 border border-white/10 rounded-2xl p-4 flex flex-col items-center">
              <p className="text-white/40 uppercase tracking-widest text-xs mb-2 font-medium">Speed Thru Water</p>
              <GaugeRing value={stw ?? 0} min={0} max={20} unit="kn" label="STW" size={150} color="#a78bfa" />
            </div>

            <DataTile label="Heading Magnetic" value={hdgMag != null ? Math.round(((hdgMag % 360) + 360) % 360).toString() : "--"} unit="°" size="sm" color="#22d3ee" />
            <DataTile label="Heading True" value={hdgTrue != null ? Math.round(((hdgTrue % 360) + 360) % 360).toString() : "--"} unit="°" size="sm" color="#a78bfa" />
            <DataTile label="COG True" value={cog != null ? Math.round(((cog % 360) + 360) % 360).toString() : "--"} unit="°" size="sm" color="#22d3ee" />
            <DataTile label="COG Magnetic" value={cogMag != null ? Math.round(((cogMag % 360) + 360) % 360).toString() : "--"} unit="°" size="sm" color="#a78bfa" />
            <DataTile label="Leeway" value={leeway != null ? fmt(leeway, 1) : "--"} unit="°" size="sm" color="#f59e0b" subValue={leeway != null ? (leeway > 0 ? "Port" : "Stbd") : undefined} />
            <DataTile label="Variation" value={variation != null ? fmt(variation, 1) : "--"} unit="°" size="sm" color="#f59e0b" />

            <div className="col-span-2 bg-white/5 border border-white/10 rounded-xl p-4">
              <div className="text-white/40 uppercase tracking-widest text-xs mb-2 font-medium">GPS Position</div>
              <div className="font-mono text-cyan-400 text-lg font-bold tracking-wide">
                {nav.position ? formatLatLon(nav.position.latitude, nav.position.longitude) : "-- No GPS Fix --"}
              </div>
            </div>

            <DataTile label="Depth Below Keel" value={depth != null ? fmt(depth) : "--"} unit="m" size="sm" color={depth != null && depth < 3 ? "#ef4444" : "#22d3ee"} subValue={depth != null && depth < 5 ? "SHALLOW WARNING" : undefined} />
            <DataTile label="Water Temp" value={nav.waterTemperature != null ? fmt(nav.waterTemperature - 273.15) : "--"} unit="°C" size="sm" color="#f59e0b" />

            <DataTile label="Trip Log" value={nav.logTrip != null ? (nav.logTrip / 1852).toFixed(1) : "--"} unit="NM" size="sm" color="#a78bfa" />
            <DataTile label="Total Log" value={nav.logTotal != null ? (nav.logTotal / 1852).toFixed(0) : "--"} unit="NM" size="sm" color="#a78bfa" />
          </div>
        </div>
      </div>
    </div>
  );
}
