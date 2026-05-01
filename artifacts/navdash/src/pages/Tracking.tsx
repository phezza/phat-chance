import { useRef, useState, useEffect, useCallback } from "react";
import { MapContainer, TileLayer, Polyline, useMap, Marker } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { PageHeader } from "@/components/PageHeader";
import { useSK } from "@/lib/SignalKContext";
import {
  MapPin,
  Play,
  Square,
  Trash2,
  Navigation2,
  Anchor,
  Route,
  Clock,
  Gauge,
} from "lucide-react";
import { cn } from "@/lib/utils";

const DEADBAND_METERS = 50;
const MIN_RECORD_DIST = 5;

function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function totalDistance(pts: [number, number][]): number {
  let d = 0;
  for (let i = 1; i < pts.length; i++) {
    d += haversine(pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1]);
  }
  return d;
}

function fmtDist(m: number): string {
  if (m < 1000) return `${Math.round(m)} m`;
  const nm = m / 1852;
  return `${nm.toFixed(2)} nm`;
}

function fmtDuration(ms: number): string {
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}h ${m.toString().padStart(2, "0")}m`;
  return `${m}m ${sec.toString().padStart(2, "0")}s`;
}

function makeBoatIcon(heading?: number) {
  const rot = heading ?? 0;
  return L.divIcon({
    className: "",
    iconSize: [28, 28],
    iconAnchor: [14, 14],
    html: `<div style="transform:rotate(${rot}deg);width:28px;height:28px;display:flex;align-items:center;justify-content:center">
      <svg width="28" height="28" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="14" cy="14" r="13" fill="#06b6d4" fill-opacity="0.25" stroke="#06b6d4" stroke-width="1.5"/>
        <polygon points="14,4 19,22 14,18 9,22" fill="#06b6d4" stroke="#fff" stroke-width="1"/>
      </svg>
    </div>`,
  });
}

function makeAnchorIcon() {
  return L.divIcon({
    className: "",
    iconSize: [20, 20],
    iconAnchor: [10, 10],
    html: `<div style="width:20px;height:20px;border-radius:50%;background:#f59e0b44;border:2px solid #f59e0b;display:flex;align-items:center;justify-content:center">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="#f59e0b" xmlns="http://www.w3.org/2000/svg">
        <path d="M12 2a3 3 0 1 0 0 6 3 3 0 0 0 0-6zm0 4a1 1 0 1 1 0-2 1 1 0 0 1 0 2zm0 4v12M8 20c0 2.2 4 2.2 4 0M16 20c0 2.2-4 2.2-4 0M4 12h4M16 12h4"/>
        <circle cx="12" cy="4" r="3" fill="none" stroke="#f59e0b" stroke-width="2"/>
        <line x1="12" y1="7" x2="12" y2="22" stroke="#f59e0b" stroke-width="2"/>
        <line x1="4" y1="12" x2="20" y2="12" stroke="#f59e0b" stroke-width="2"/>
        <path d="M4 12a8 8 0 0 0 16 0" fill="none" stroke="#f59e0b" stroke-width="2"/>
      </svg>
    </div>`,
  });
}

function MapRecenter({ lat, lon, follow }: { lat: number; lon: number; follow: boolean }) {
  const map = useMap();
  const initialised = useRef(false);

  useEffect(() => {
    if (!lat || !lon) return;
    if (!initialised.current) {
      map.setView([lat, lon], 14);
      initialised.current = true;
    } else if (follow) {
      map.panTo([lat, lon], { animate: true, duration: 1 });
    }
  }, [lat, lon, follow, map]);

  return null;
}

const STORAGE_KEY = "navdash_track_v1";

interface StoredTrack {
  points: [number, number][];
  startTime: number | null;
  totalMs: number;
}

function loadStoredTrack(): StoredTrack {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return { points: [], startTime: null, totalMs: 0 };
}

function saveStoredTrack(t: StoredTrack) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(t));
  } catch {}
}

type TrackState = "idle" | "armed" | "recording";

export function Tracking() {
  const { nav } = useSK();
  const lat = nav.position?.latitude;
  const lon = nav.position?.longitude;
  const sog = nav.speedOverGround;
  const hdg = nav.headingTrue ?? nav.headingMagnetic;

  const stored = useRef(loadStoredTrack());
  const [trackPoints, setTrackPoints] = useState<[number, number][]>(stored.current.points);
  const [trackState, setTrackState] = useState<TrackState>("idle");
  const [anchor, setAnchor] = useState<[number, number] | null>(null);
  const [follow, setFollow] = useState(true);
  const [startTime, setStartTime] = useState<number | null>(stored.current.startTime);
  const [elapsedMs, setElapsedMs] = useState(stored.current.totalMs);
  const [maxSpeed, setMaxSpeed] = useState(0);

  const lastPoint = useRef<[number, number] | null>(
    trackPoints.length > 0 ? trackPoints[trackPoints.length - 1] : null
  );

  useEffect(() => {
    if (trackState !== "recording" || !startTime) return;
    const id = setInterval(() => setElapsedMs(Date.now() - startTime + stored.current.totalMs), 1000);
    return () => clearInterval(id);
  }, [trackState, startTime]);

  useEffect(() => {
    if (!lat || !lon || trackState === "idle") return;

    if (trackState === "armed" && anchor) {
      const d = haversine(anchor[0], anchor[1], lat, lon);
      if (d >= DEADBAND_METERS) {
        setTrackState("recording");
        const pt: [number, number] = [lat, lon];
        lastPoint.current = pt;
        setTrackPoints([pt]);
        if (sog) setMaxSpeed(sog);
      }
      return;
    }

    if (trackState === "recording") {
      const prev = lastPoint.current;
      if (!prev || haversine(prev[0], prev[1], lat, lon) >= MIN_RECORD_DIST) {
        const pt: [number, number] = [lat, lon];
        lastPoint.current = pt;
        if (sog && sog > maxSpeed) setMaxSpeed(sog);
        setTrackPoints((pts) => {
          const next = [...pts, pt];
          const s: StoredTrack = {
            points: next,
            startTime,
            totalMs: stored.current.totalMs,
          };
          stored.current = s;
          saveStoredTrack(s);
          return next;
        });
      }
    }
  }, [lat, lon, trackState]);

  const startTracking = useCallback(() => {
    if (!lat || !lon) return;
    setAnchor([lat, lon]);
    setTrackState("armed");
    const now = Date.now();
    setStartTime(now);
    setMaxSpeed(0);
    stored.current = { points: [], startTime: now, totalMs: 0 };
  }, [lat, lon]);

  const stopTracking = useCallback(() => {
    const elapsed = startTime ? Date.now() - startTime + stored.current.totalMs : stored.current.totalMs;
    stored.current = { ...stored.current, startTime: null, totalMs: elapsed };
    saveStoredTrack(stored.current);
    setElapsedMs(elapsed);
    setTrackState("idle");
    setStartTime(null);
  }, [startTime]);

  const clearTrack = useCallback(() => {
    setTrackPoints([]);
    setTrackState("idle");
    setAnchor(null);
    setStartTime(null);
    setElapsedMs(0);
    setMaxSpeed(0);
    lastPoint.current = null;
    stored.current = { points: [], startTime: null, totalMs: 0 };
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  const hasGPS = !!(lat && lon);
  const distM = totalDistance(trackPoints);

  return (
    <div className="flex flex-col h-full bg-[#070d1a]">
      <PageHeader
        title="Track Log"
        icon={Route}
        badge={
          <>
            {trackState === "armed" && (
              <span className="px-2 py-0.5 rounded-full text-xs font-mono bg-amber-500/15 text-amber-400 border border-amber-500/25 animate-pulse">
                WAITING 50m
              </span>
            )}
            {trackState === "recording" && (
              <span className="px-2 py-0.5 rounded-full text-xs font-mono bg-green-500/15 text-green-400 border border-green-500/25">
                ● RECORDING
              </span>
            )}
          </>
        }
      >
        {trackState === "idle" ? (
          <button
            onClick={startTracking}
            disabled={!hasGPS}
            className={cn(
              "flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all border",
              hasGPS
                ? "bg-green-500/15 text-green-400 border-green-500/30 hover:bg-green-500/25"
                : "bg-white/5 text-white/20 border-white/10 cursor-not-allowed"
            )}
          >
            <Play className="w-3.5 h-3.5" />
            Start
          </button>
        ) : (
          <button
            onClick={stopTracking}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium bg-red-500/15 text-red-400 border border-red-500/30 hover:bg-red-500/25 transition-all"
          >
            <Square className="w-3.5 h-3.5" />
            Stop
          </button>
        )}
        <button
          onClick={clearTrack}
          disabled={trackPoints.length === 0 && trackState === "idle"}
          className={cn(
            "flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all border",
            trackPoints.length > 0 || trackState !== "idle"
              ? "bg-white/5 text-white/50 border-white/10 hover:bg-white/10 hover:text-white/70"
              : "bg-white/5 text-white/20 border-white/5 cursor-not-allowed"
          )}
        >
          <Trash2 className="w-3.5 h-3.5" />
          Clear
        </button>
        <button
          onClick={() => setFollow((f) => !f)}
          title={follow ? "Unfollow boat" : "Follow boat"}
          className={cn(
            "w-8 h-8 rounded-lg flex items-center justify-center transition-all border",
            follow
              ? "bg-cyan-500/15 text-cyan-400 border-cyan-500/30"
              : "bg-white/5 text-white/40 border-white/10 hover:bg-white/10"
          )}
        >
          <Navigation2 className="w-3.5 h-3.5" />
        </button>
      </PageHeader>

      <div className="flex-shrink-0 grid grid-cols-2 sm:grid-cols-4 gap-2 px-4 py-3 border-b border-white/8">
        <StatBox
          label="Distance"
          value={trackPoints.length > 1 ? fmtDist(distM) : "—"}
          icon={<Route className="w-3.5 h-3.5" />}
          color="cyan"
        />
        <StatBox
          label="Duration"
          value={elapsedMs > 0 ? fmtDuration(elapsedMs) : "—"}
          icon={<Clock className="w-3.5 h-3.5" />}
          color="purple"
        />
        <StatBox
          label="Max Speed"
          value={maxSpeed > 0 ? `${(maxSpeed * 1.94384).toFixed(1)} kn` : "—"}
          icon={<Gauge className="w-3.5 h-3.5" />}
          color="amber"
        />
        <StatBox
          label="Position"
          value={hasGPS ? `${lat!.toFixed(4)}° ${lon!.toFixed(4)}°` : "No GPS"}
          icon={<MapPin className="w-3.5 h-3.5" />}
          color={hasGPS ? "green" : "red"}
        />
      </div>

      <div className="flex-1 relative min-h-0">
        {!hasGPS && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-[#070d1a]/80 backdrop-blur-sm">
            <MapPin className="w-10 h-10 text-white/20" />
            <p className="text-white/40 text-sm">No GPS signal — connect to your boat's network</p>
          </div>
        )}

        <MapContainer
          center={hasGPS ? [lat!, lon!] : [51.505, -0.09]}
          zoom={14}
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

          {hasGPS && (
            <MapRecenter lat={lat!} lon={lon!} follow={follow && trackState === "recording"} />
          )}

          {trackPoints.length > 1 && (
            <Polyline
              positions={trackPoints}
              pathOptions={{ color: "#06b6d4", weight: 3, opacity: 0.85 }}
            />
          )}

          {anchor && (
            <Marker position={anchor} icon={makeAnchorIcon()} />
          )}

          {hasGPS && (
            <Marker
              position={[lat!, lon!]}
              icon={makeBoatIcon(hdg)}
            />
          )}
        </MapContainer>

        {trackState === "armed" && anchor && hasGPS && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-[1000] px-4 py-2 rounded-xl bg-[#0a1628]/90 border border-amber-500/30 text-amber-400 text-sm font-mono backdrop-blur-sm">
            {haversine(anchor[0], anchor[1], lat!, lon!).toFixed(0)} m / {DEADBAND_METERS} m — move to start logging
          </div>
        )}
      </div>
    </div>
  );
}

function StatBox({
  label,
  value,
  icon,
  color,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  color: "cyan" | "purple" | "amber" | "green" | "red";
}) {
  const colors = {
    cyan: "text-cyan-400",
    purple: "text-purple-400",
    amber: "text-amber-400",
    green: "text-green-400",
    red: "text-red-400",
  };
  return (
    <div className="bg-white/3 border border-white/8 rounded-xl px-3 py-2.5 flex flex-col gap-1">
      <div className={cn("flex items-center gap-1.5 text-xs opacity-60 font-mono uppercase tracking-wider", colors[color])}>
        {icon}
        {label}
      </div>
      <div className={cn("text-sm font-mono font-semibold truncate", colors[color])}>{value}</div>
    </div>
  );
}
