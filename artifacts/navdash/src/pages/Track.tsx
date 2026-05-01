import { useEffect, useState, useRef } from "react";
import { useRoute } from "wouter";
import { MapContainer, TileLayer, Polyline, Marker, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Share2, AlertCircle } from "lucide-react";
import { mpsToKnots, radToDeg } from "@/lib/signalk";

interface TrackPoint {
  id: number;
  vesselId: string;
  recordedAt: string;
  latitude: number;
  longitude: number;
  speedOverGround?: number;
  courseOverGround?: number;
  headingTrue?: number;
  headingMagnetic?: number;
  depth?: number;
  waterTemperature?: number;
  windSpeedTrue?: number;
  windAngleTrue?: number;
  windSpeedApparent?: number;
  windAngleApparent?: number;
}

const REFRESH_MS = 30_000;
const HISTORY_MINUTES = 1440; // 24 hours

function makeBoatIcon(headingDeg: number | undefined) {
  const rot = headingDeg ?? 0;
  return L.divIcon({
    className: "boat-icon",
    html: `<div style="transform: rotate(${rot}deg); transform-origin: center;">
      <svg width="32" height="32" viewBox="0 0 32 32">
        <polygon points="16,2 26,28 16,22 6,28" fill="#22d3ee" stroke="#0a1628" stroke-width="1.5"/>
      </svg>
    </div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
  });
}

function MapRecenter({ lat, lon, follow }: { lat: number; lon: number; follow: boolean }) {
  const map = useMap();
  const didFitOnce = useRef(false);
  useEffect(() => {
    if (!didFitOnce.current) {
      map.setView([lat, lon], 13);
      didFitOnce.current = true;
    } else if (follow) {
      map.panTo([lat, lon]);
    }
  }, [lat, lon, follow, map]);
  return null;
}

function Stat({ label, value, unit, sub }: { label: string; value: string; unit?: string; sub?: string }) {
  return (
    <div className="bg-white/5 border border-white/10 rounded-xl p-3">
      <div className="text-white/40 uppercase tracking-widest text-[10px]">{label}</div>
      <div className="text-white font-bold text-lg leading-tight">
        {value}
        {unit && <span className="text-white/40 text-sm ml-1 font-normal">{unit}</span>}
      </div>
      {sub && <div className="text-white/40 text-xs mt-0.5">{sub}</div>}
    </div>
  );
}

export function Track() {
  const [, params] = useRoute("/track/:vesselId");
  const vesselId = params?.vesselId;
  const [points, setPoints] = useState<TrackPoint[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [follow, setFollow] = useState(true);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!vesselId) return;
    let cancelled = false;
    async function load() {
      try {
        const base = import.meta.env.BASE_URL.endsWith("/")
          ? import.meta.env.BASE_URL
          : `${import.meta.env.BASE_URL}/`;
        const url = `${base}api/track/${encodeURIComponent(vesselId!)}/history?sinceMinutes=${HISTORY_MINUTES}`;
        const res = await fetch(url);
        if (!res.ok) {
          if (res.status === 404) {
            setPoints([]);
            setError(null);
          } else {
            setError(`Server error: ${res.status}`);
          }
          return;
        }
        const data: TrackPoint[] = await res.json();
        if (!cancelled) {
          setPoints(data);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    const id = setInterval(load, REFRESH_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [vesselId]);

  if (!vesselId) {
    return (
      <div className="min-h-screen bg-[#020617] text-white p-6">
        Missing vessel ID
      </div>
    );
  }

  const latest = points.length > 0 ? points[points.length - 1] : null;
  const trail: [number, number][] = points.map((p) => [p.latitude, p.longitude]);

  const sogKn = latest?.speedOverGround != null ? mpsToKnots(latest.speedOverGround) : undefined;
  const cogDeg = latest?.courseOverGround != null
    ? ((radToDeg(latest.courseOverGround) % 360) + 360) % 360
    : undefined;
  const hdgRad = latest?.headingTrue ?? latest?.headingMagnetic;
  const hdgDeg = hdgRad != null ? ((radToDeg(hdgRad) % 360) + 360) % 360 : undefined;
  const depthM = latest?.depth;
  const waterTempC = latest?.waterTemperature != null ? latest.waterTemperature - 273.15 : undefined;
  const twsKn = latest?.windSpeedTrue != null ? mpsToKnots(latest.windSpeedTrue) : undefined;
  const twaDeg = latest?.windAngleTrue != null ? radToDeg(latest.windAngleTrue) : undefined;

  let ageStr = "—";
  if (latest) {
    const ageMs = now - new Date(latest.recordedAt).getTime();
    if (ageMs < 60_000) ageStr = `${Math.floor(ageMs / 1000)}s ago`;
    else if (ageMs < 3_600_000) ageStr = `${Math.floor(ageMs / 60_000)}m ago`;
    else if (ageMs < 86_400_000) ageStr = `${Math.floor(ageMs / 3_600_000)}h ago`;
    else ageStr = `${Math.floor(ageMs / 86_400_000)}d ago`;
  }
  const isStale = latest ? now - new Date(latest.recordedAt).getTime() > 5 * 60_000 : false;

  return (
    <div className="min-h-screen bg-[#020617] text-white flex flex-col">
      <div className="border-b border-white/10 px-4 py-3 flex items-center justify-between bg-black/30 backdrop-blur">
        <div className="flex items-center gap-3">
          <Share2 className="w-5 h-5 text-cyan-400" />
          <div>
            <div className="text-lg font-bold">{vesselId}</div>
            <div className="text-white/40 text-xs">Live tracker · {ageStr} {isStale && "· stale"}</div>
          </div>
        </div>
        <button
          onClick={() => setFollow((f) => !f)}
          className={`px-3 py-1.5 rounded-lg border text-xs font-medium ${follow ? "bg-cyan-500/20 border-cyan-400/40 text-cyan-100" : "bg-white/5 border-white/10 text-white/60"}`}
        >
          {follow ? "Following" : "Follow off"}
        </button>
      </div>

      {loading && points.length === 0 && (
        <div className="flex-1 flex items-center justify-center text-white/40">Loading tracker…</div>
      )}

      {error && (
        <div className="m-4 p-4 bg-red-500/10 border border-red-500/30 rounded-xl flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-400 mt-0.5" />
          <div>
            <div className="text-red-200 font-medium">Couldn't load tracker</div>
            <div className="text-red-300/70 text-sm font-mono mt-1">{error}</div>
          </div>
        </div>
      )}

      {!loading && !error && points.length === 0 && (
        <div className="flex-1 flex items-center justify-center text-white/40 text-center px-6">
          <div>
            <div className="text-lg mb-2">No data yet for "{vesselId}"</div>
            <div className="text-sm">The boat hasn't uploaded a position in the last 24 hours.</div>
          </div>
        </div>
      )}

      {latest && (
        <>
          <div className="flex-1 relative" style={{ minHeight: "50vh" }}>
            <MapContainer
              center={[latest.latitude, latest.longitude]}
              zoom={13}
              style={{ height: "100%", width: "100%", background: "#0a1628" }}
              zoomControl={true}
            >
              <TileLayer
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                opacity={0.85}
              />
              <TileLayer
                url="https://tiles.openseamap.org/seamark/{z}/{x}/{y}.png"
                attribution='&copy; <a href="https://www.openseamap.org">OpenSeaMap</a>'
              />
              <MapRecenter lat={latest.latitude} lon={latest.longitude} follow={follow} />
              {trail.length > 1 && (
                <Polyline positions={trail} pathOptions={{ color: "#06b6d4", weight: 3, opacity: 0.85 }} />
              )}
              <Marker position={[latest.latitude, latest.longitude]} icon={makeBoatIcon(hdgDeg ?? cogDeg)} />
            </MapContainer>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2 p-3 bg-black/40 border-t border-white/10">
            <Stat label="SOG" value={sogKn != null ? sogKn.toFixed(1) : "—"} unit="kn" />
            <Stat label="COG" value={cogDeg != null ? Math.round(cogDeg).toString() : "—"} unit="°" />
            <Stat label="HDG" value={hdgDeg != null ? Math.round(hdgDeg).toString() : "—"} unit="°" sub={latest.headingTrue != null ? "True" : latest.headingMagnetic != null ? "Magnetic" : undefined} />
            <Stat label="Depth" value={depthM != null ? depthM.toFixed(1) : "—"} unit="m" />
            <Stat label="Water" value={waterTempC != null ? waterTempC.toFixed(1) : "—"} unit="°C" />
            <Stat label="TWS" value={twsKn != null ? twsKn.toFixed(1) : "—"} unit="kn" />
            <Stat label="TWA" value={twaDeg != null ? Math.round(twaDeg).toString() : "—"} unit="°" />
          </div>

          <div className="px-4 py-2 bg-black/30 border-t border-white/5 text-white/40 text-[11px] flex flex-wrap gap-x-4 gap-y-1 justify-between">
            <span>{latest.latitude.toFixed(5)}°, {latest.longitude.toFixed(5)}°</span>
            <span>{points.length} points · last 24h</span>
            <span>Updates every {REFRESH_MS / 1000}s</span>
          </div>
        </>
      )}
    </div>
  );
}
