import { useEffect, useMemo, useRef, useState } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Polyline,
  useMap,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { Map as MapIcon, Navigation2, Layers, Cloud, Anchor, Radio, Wind as WindIcon, Gauge, Compass } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { useSK } from "@/lib/SignalKContext";
import { mpsToKnots, radToDeg, getAISShipTypeName } from "@/lib/signalk";
import { makeBoatIcon, makeAISIcon, getAISShipColor } from "@/lib/mapIcons";
import { cn } from "@/lib/utils";

interface RainViewerFrame {
  time: number;
  path: string;
}

interface RainViewerData {
  host: string;
  radar?: { past?: RainViewerFrame[] };
}

function MapRecenter({ lat, lon, follow }: { lat: number; lon: number; follow: boolean }) {
  const map = useMap();
  const initialised = useRef(false);
  useEffect(() => {
    const t = setTimeout(() => map.invalidateSize(), 0);
    if (!lat || !lon) return;
    if (!initialised.current) {
      map.setView([lat, lon], 13);
      initialised.current = true;
    } else if (follow) {
      map.panTo([lat, lon], { animate: true, duration: 1 });
    }
    return () => clearTimeout(t);
  }, [lat, lon, follow, map]);
  return null;
}

function HudTile({
  label,
  value,
  unit,
  sub,
  color = "#22d3ee",
  Icon,
}: {
  label: string;
  value: string;
  unit?: string;
  sub?: string;
  color?: string;
  Icon?: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="bg-[#070d1a]/80 backdrop-blur-md border border-white/10 rounded-xl px-3 py-2 min-w-[88px]">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-white/45 font-mono">
        {Icon && <Icon className="w-3 h-3" />}
        {label}
      </div>
      <div className="text-white font-bold text-base leading-tight font-mono" style={{ color }}>
        {value}
        {unit && <span className="text-white/40 text-xs ml-0.5 font-normal">{unit}</span>}
      </div>
      {sub && <div className="text-white/35 text-[10px] mt-0.5">{sub}</div>}
    </div>
  );
}

function LayerToggle({
  active,
  onClick,
  Icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  Icon: React.ComponentType<{ className?: string }>;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all",
        active
          ? "bg-cyan-500/15 text-cyan-300 border-cyan-500/35"
          : "bg-white/5 text-white/45 border-white/10 hover:text-white/70 hover:bg-white/10"
      )}
    >
      <Icon className="w-3.5 h-3.5" />
      {label}
    </button>
  );
}

const TRAIL_KEY = "navdash_charts_trail_v1";
const MAX_TRAIL_POINTS = 1500;
const MIN_TRAIL_DIST_M = 8;

function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;
  const a = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function loadTrail(): [number, number][] {
  try {
    const raw = localStorage.getItem(TRAIL_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return [];
}

function saveTrail(trail: [number, number][]) {
  try {
    localStorage.setItem(TRAIL_KEY, JSON.stringify(trail));
  } catch {}
}

export function Charts() {
  const { nav, aisTargets } = useSK();
  const [follow, setFollow] = useState(true);
  const [showSeamarks, setShowSeamarks] = useState(true);
  const [showRain, setShowRain] = useState(false);
  const [showAIS, setShowAIS] = useState(true);
  const [showHud, setShowHud] = useState(true);
  const [showTrail, setShowTrail] = useState(true);
  const [baseStyle, setBaseStyle] = useState<"osm" | "dark">("dark");
  const [rainData, setRainData] = useState<RainViewerData | null>(null);

  const lat = nav.position?.latitude;
  const lon = nav.position?.longitude;
  const hdgRad = nav.headingTrue ?? nav.headingMagnetic;
  const hdgDeg = hdgRad != null ? ((radToDeg(hdgRad) % 360) + 360) % 360 : undefined;
  const cogDeg = nav.courseOverGroundTrue != null
    ? ((radToDeg(nav.courseOverGroundTrue) % 360) + 360) % 360
    : undefined;

  const sogKn = nav.speedOverGround != null ? mpsToKnots(nav.speedOverGround) : undefined;
  const stwKn = nav.speedThroughWater != null ? mpsToKnots(nav.speedThroughWater) : undefined;
  const depth = nav.depthBelowKeel ?? nav.depthBelowSurface;
  const tws = nav.windSpeedTrue != null ? mpsToKnots(nav.windSpeedTrue) : undefined;
  const aws = nav.windSpeedApparent != null ? mpsToKnots(nav.windSpeedApparent) : undefined;
  const twa = nav.windAngleTrue != null ? radToDeg(nav.windAngleTrue) : undefined;
  const awa = nav.windAngleApparent != null ? radToDeg(nav.windAngleApparent) : undefined;
  const waterTempC = nav.waterTemperature != null ? nav.waterTemperature - 273.15 : undefined;

  // Trail accumulation (live in-memory + persisted)
  const [trail, setTrail] = useState<[number, number][]>(() => loadTrail());
  const lastTrailRef = useRef<[number, number] | null>(trail[trail.length - 1] ?? null);
  useEffect(() => {
    if (lat == null || lon == null) return;
    const last = lastTrailRef.current;
    if (last && haversine(last[0], last[1], lat, lon) < MIN_TRAIL_DIST_M) return;
    const pt: [number, number] = [lat, lon];
    lastTrailRef.current = pt;
    setTrail((prev) => {
      const next = [...prev, pt].slice(-MAX_TRAIL_POINTS);
      saveTrail(next);
      return next;
    });
  }, [lat, lon]);

  // Fetch RainViewer index when rain layer enabled
  useEffect(() => {
    if (!showRain) return;
    let cancelled = false;
    fetch("https://api.rainviewer.com/public/weather-maps.json")
      .then((r) => r.json())
      .then((data: RainViewerData) => {
        if (!cancelled) setRainData(data);
      })
      .catch(() => {
        if (!cancelled) setRainData(null);
      });
    const id = setInterval(() => {
      fetch("https://api.rainviewer.com/public/weather-maps.json")
        .then((r) => r.json())
        .then((data: RainViewerData) => {
          if (!cancelled) setRainData(data);
        })
        .catch(() => {});
    }, 5 * 60 * 1000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [showRain]);

  const rainUrl = useMemo(() => {
    if (!showRain || !rainData?.radar?.past?.length) return null;
    const frames = rainData.radar.past;
    const latest = frames[frames.length - 1];
    return `${rainData.host}${latest.path}/256/{z}/{x}/{y}/2/1_1.png`;
  }, [showRain, rainData]);

  const aisList = useMemo(() => {
    if (!showAIS) return [];
    return Array.from(aisTargets.values()).filter((t) => t.position);
  }, [aisTargets, showAIS]);

  const hasGPS = lat != null && lon != null;
  const center: [number, number] = hasGPS ? [lat!, lon!] : [37.8, -122.4];

  return (
    <div className="flex flex-col h-full bg-[#070d1a]" data-testid="charts-page">
      <PageHeader title="Charts" icon={MapIcon}>
        <button
          onClick={() => setFollow((f) => !f)}
          title={follow ? "Stop following" : "Follow boat"}
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

      {/* Layer control bar */}
      <div className="flex-shrink-0 flex flex-wrap items-center gap-2 px-4 py-2.5 border-b border-white/8 bg-black/20">
        <div className="flex items-center gap-1.5 text-white/35 text-[10px] uppercase tracking-widest font-mono mr-1">
          <Layers className="w-3 h-3" /> Layers
        </div>
        <div className="flex items-center gap-1 bg-white/5 rounded-lg p-0.5 border border-white/10">
          <button
            onClick={() => setBaseStyle("dark")}
            className={cn(
              "px-2.5 py-1 rounded-md text-xs font-medium transition-colors",
              baseStyle === "dark" ? "bg-cyan-500/20 text-cyan-300" : "text-white/40 hover:text-white/70"
            )}
          >
            Dark
          </button>
          <button
            onClick={() => setBaseStyle("osm")}
            className={cn(
              "px-2.5 py-1 rounded-md text-xs font-medium transition-colors",
              baseStyle === "osm" ? "bg-cyan-500/20 text-cyan-300" : "text-white/40 hover:text-white/70"
            )}
          >
            OSM
          </button>
        </div>
        <LayerToggle active={showSeamarks} onClick={() => setShowSeamarks((v) => !v)} Icon={Anchor} label="Seamarks" />
        <LayerToggle active={showRain} onClick={() => setShowRain((v) => !v)} Icon={Cloud} label="Rain" />
        <LayerToggle active={showAIS} onClick={() => setShowAIS((v) => !v)} Icon={Radio} label={`AIS${showAIS && aisList.length ? ` (${aisList.length})` : ""}`} />
        <LayerToggle active={showTrail} onClick={() => setShowTrail((v) => !v)} Icon={Navigation2} label={`Trail${showTrail && trail.length > 1 ? ` (${trail.length})` : ""}`} />
        <div className="flex-1" />
        <LayerToggle active={showHud} onClick={() => setShowHud((v) => !v)} Icon={Gauge} label="Instruments" />
      </div>

      {/* Map */}
      <div className="flex-1 relative min-h-0">
        {!hasGPS && (
          <div className="absolute inset-0 z-[1000] flex flex-col items-center justify-center gap-2 bg-[#070d1a]/80 backdrop-blur-sm pointer-events-none">
            <MapIcon className="w-10 h-10 text-white/20" />
            <p className="text-white/40 text-sm">No GPS fix — connect to your boat's network</p>
          </div>
        )}

        <MapContainer
          center={center}
          zoom={13}
          style={{ height: "100%", width: "100%", background: "#0a1628" }}
          zoomControl={true}
        >
          {baseStyle === "dark" ? (
            <TileLayer
              url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
              subdomains={["a", "b", "c", "d"]}
              maxZoom={19}
            />
          ) : (
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              opacity={0.9}
            />
          )}

          {showSeamarks && (
            <TileLayer
              url="https://tiles.openseamap.org/seamark/{z}/{x}/{y}.png"
              attribution='&copy; <a href="https://www.openseamap.org">OpenSeaMap</a>'
            />
          )}

          {rainUrl && (
            <TileLayer
              key={rainUrl}
              url={rainUrl}
              opacity={0.6}
              attribution='Radar &copy; <a href="https://www.rainviewer.com/">RainViewer</a>'
            />
          )}

          {hasGPS && (
            <MapRecenter lat={lat!} lon={lon!} follow={follow} />
          )}

          {showTrail && trail.length > 1 && (
            <Polyline
              positions={trail}
              pathOptions={{ color: "#06b6d4", weight: 2.5, opacity: 0.7 }}
            />
          )}

          {showAIS &&
            aisList.map((t) => {
              const color = getAISShipColor(t.shipType);
              const heading = t.heading != null ? ((radToDeg(t.heading) % 360) + 360) % 360 : undefined;
              const cog = t.cog != null ? ((radToDeg(t.cog) % 360) + 360) % 360 : undefined;
              const label = t.name ?? `MMSI ${t.mmsi}`;
              return (
                <Marker
                  key={t.mmsi}
                  position={[t.position!.latitude, t.position!.longitude]}
                  icon={makeAISIcon({ color, headingDeg: heading, cogDeg: cog, label })}
                  title={`${label} · ${getAISShipTypeName(t.shipType)}${t.sog != null ? ` · ${mpsToKnots(t.sog).toFixed(1)}kn` : ""}`}
                />
              );
            })}

          {hasGPS && (
            <Marker position={[lat!, lon!]} icon={makeBoatIcon(hdgDeg ?? cogDeg)} />
          )}
        </MapContainer>

        {/* HUD overlay */}
        {showHud && (
          <div className="pointer-events-none absolute top-3 right-3 left-16 flex flex-wrap gap-2 justify-end z-[1100]">
            <HudTile label="SOG" value={sogKn != null ? sogKn.toFixed(1) : "—"} unit="kn" Icon={Gauge} color="#22d3ee" />
            <HudTile label="COG" value={cogDeg != null ? Math.round(cogDeg).toString() : "—"} unit="°" Icon={Compass} color="#a78bfa" />
            <HudTile
              label="HDG"
              value={hdgDeg != null ? Math.round(hdgDeg).toString() : "—"}
              unit="°"
              Icon={Compass}
              color="#22d3ee"
              sub={nav.headingTrue != null ? "True" : nav.headingMagnetic != null ? "Mag" : undefined}
            />
            <HudTile label="STW" value={stwKn != null ? stwKn.toFixed(1) : "—"} unit="kn" color="#67e8f9" />
            <HudTile label="Depth" value={depth != null ? depth.toFixed(1) : "—"} unit="m" color="#f59e0b" />
            <HudTile
              label="Wind"
              value={tws != null ? tws.toFixed(1) : aws != null ? aws.toFixed(1) : "—"}
              unit="kn"
              Icon={WindIcon}
              color="#a7f3d0"
              sub={tws != null ? `TWS · ${twa != null ? Math.round(twa) + "°" : ""}` : aws != null ? `AWS · ${awa != null ? Math.round(awa) + "°" : ""}` : undefined}
            />
            {waterTempC != null && (
              <HudTile label="Water" value={waterTempC.toFixed(1)} unit="°C" color="#bae6fd" />
            )}
          </div>
        )}

        {/* Position chip */}
        {hasGPS && (
          <div className="pointer-events-none absolute bottom-3 left-3 z-[1100] px-3 py-1.5 rounded-lg bg-[#070d1a]/80 backdrop-blur-md border border-white/10 text-white/70 text-[11px] font-mono">
            {lat!.toFixed(5)}°, {lon!.toFixed(5)}°
          </div>
        )}

        {showRain && !rainUrl && (
          <div className="pointer-events-none absolute bottom-3 right-3 z-[1100] px-3 py-1.5 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-300 text-[11px]">
            Loading radar…
          </div>
        )}
      </div>
    </div>
  );
}
