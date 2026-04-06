import { useSK } from "@/lib/SignalKContext";
import { mpsToKnots, radToDeg } from "@/lib/signalk";
import { DataTile } from "@/components/DataTile";
import { GaugeRing } from "@/components/GaugeRing";
import { WindRose } from "@/components/WindRose";

function fmt(val: number | undefined, decimals = 1): string {
  if (val == null || !Number.isFinite(val)) return "--";
  return val.toFixed(decimals);
}

function getBeaufortScale(knots: number): { force: number; description: string } {
  if (knots < 1) return { force: 0, description: "Calm" };
  if (knots < 4) return { force: 1, description: "Light Air" };
  if (knots < 7) return { force: 2, description: "Light Breeze" };
  if (knots < 11) return { force: 3, description: "Gentle Breeze" };
  if (knots < 16) return { force: 4, description: "Moderate Breeze" };
  if (knots < 22) return { force: 5, description: "Fresh Breeze" };
  if (knots < 28) return { force: 6, description: "Strong Breeze" };
  if (knots < 34) return { force: 7, description: "Near Gale" };
  if (knots < 41) return { force: 8, description: "Gale" };
  if (knots < 48) return { force: 9, description: "Severe Gale" };
  if (knots < 56) return { force: 10, description: "Storm" };
  if (knots < 64) return { force: 11, description: "Violent Storm" };
  return { force: 12, description: "Hurricane Force" };
}

function getWindDescription(angle: number): string {
  const dirs = ["Head", "Head Stbd", "Beam Stbd", "Aft Stbd", "Aft", "Aft Port", "Beam Port", "Head Port"];
  const idx = Math.round(((angle % 360) + 360) % 360 / 45) % 8;
  return dirs[idx];
}

export function Wind() {
  const { nav } = useSK();

  const aws = nav.windSpeedApparent != null ? mpsToKnots(nav.windSpeedApparent) : undefined;
  const tws = nav.windSpeedTrue != null ? mpsToKnots(nav.windSpeedTrue) : undefined;
  const awa = nav.windAngleApparent != null ? radToDeg(nav.windAngleApparent) : undefined;
  const twa = nav.windAngleTrue != null ? radToDeg(nav.windAngleTrue) : undefined;

  const beaufort = tws != null ? getBeaufortScale(tws) : aws != null ? getBeaufortScale(aws) : null;

  const beaufortColor = beaufort
    ? beaufort.force <= 3 ? "#22d3ee" : beaufort.force <= 5 ? "#22c55e" : beaufort.force <= 7 ? "#f59e0b" : "#ef4444"
    : "#22d3ee";

  return (
    <div className="flex flex-col gap-4 p-4" data-testid="wind-page">
      <div className="grid grid-cols-12 gap-4">
        <div className="col-span-12 lg:col-span-5 flex flex-col items-center gap-4">
          <div className="w-full bg-white/5 border border-white/10 rounded-2xl p-6 flex flex-col items-center">
            <p className="text-white/40 uppercase tracking-widest text-xs mb-4 font-medium">Wind Direction</p>
            <WindRose
              apparentAngle={awa}
              apparentSpeed={aws}
              trueAngle={twa}
              trueSpeed={tws}
              size={240}
            />
            <div className="mt-4 flex gap-4 text-sm">
              <div className="flex items-center gap-2">
                <div className="w-3 h-0.5 bg-cyan-400 rounded" />
                <span className="text-white/50">Apparent</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-0.5 bg-cyan-400/40 rounded" />
                <span className="text-white/50">True</span>
              </div>
            </div>
          </div>

          {beaufort && (
            <div className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-center">
              <p className="text-white/40 uppercase tracking-widest text-xs mb-2 font-medium">Beaufort Scale</p>
              <div className="text-6xl font-bold font-mono" style={{ color: beaufortColor }}>
                {beaufort.force}
              </div>
              <div className="text-white/60 mt-1 font-medium">{beaufort.description}</div>
            </div>
          )}
        </div>

        <div className="col-span-12 lg:col-span-7 grid grid-cols-2 gap-4 content-start">
          <div className="bg-white/5 border border-white/10 rounded-2xl p-4 flex flex-col items-center">
            <p className="text-white/40 uppercase tracking-widest text-xs mb-2 font-medium">Apparent Wind Speed</p>
            <GaugeRing value={aws ?? 0} min={0} max={50} unit="kn" label="AWS" size={160} color="#22d3ee" />
          </div>
          <div className="bg-white/5 border border-white/10 rounded-2xl p-4 flex flex-col items-center">
            <p className="text-white/40 uppercase tracking-widest text-xs mb-2 font-medium">True Wind Speed</p>
            <GaugeRing value={tws ?? 0} min={0} max={50} unit="kn" label="TWS" size={160} color="rgba(34,211,238,0.6)" />
          </div>

          <DataTile
            label="Apparent Wind Angle"
            value={awa != null ? fmt(awa, 0) : "--"}
            unit="°"
            size="md"
            color="#22d3ee"
            subValue={awa != null ? getWindDescription(awa) : undefined}
          />
          <DataTile
            label="True Wind Angle"
            value={twa != null ? fmt(twa, 0) : "--"}
            unit="°"
            size="md"
            color="rgba(34,211,238,0.7)"
            subValue={twa != null ? getWindDescription(twa) : undefined}
          />

          <DataTile
            label="Upwind VMG"
            value={tws != null && twa != null
              ? fmt(tws * Math.abs(Math.cos((twa * Math.PI) / 180)))
              : "--"}
            unit="kn"
            size="sm"
            color="#a78bfa"
          />
          <DataTile
            label="Crosswind"
            value={tws != null && twa != null
              ? fmt(Math.abs(tws * Math.sin((twa * Math.PI) / 180)))
              : "--"}
            unit="kn"
            size="sm"
            color="#f59e0b"
          />
        </div>
      </div>
    </div>
  );
}
