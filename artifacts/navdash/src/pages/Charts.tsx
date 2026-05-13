import { useEffect, useMemo, useRef, useState } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Polyline,
  useMap,
  useMapEvents,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";
import {
  Map as MapIcon,
  Navigation2,
  Layers,
  Cloud,
  Anchor,
  Radio,
  Wind as WindIcon,
  Gauge,
  Compass,
  Route as RouteIcon,
  Plus,
  Trash2,
  AlertTriangle,
} from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { useSK } from "@/lib/SignalKContext";
import { mpsToKnots, radToDeg, getAISShipTypeName } from "@/lib/signalk";
import { makeBoatIcon, makeAISIcon, getAISShipColor, makeWaypointIcon } from "@/lib/mapIcons";
import { tryComputeCPAForTarget, classifyThreat, fmtNm, fmtTcpa } from "@/lib/cpa";
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

function MapClickHandler({
  enabled,
  onClick,
}: {
  enabled: boolean;
  onClick: (lat: number, lon: number) => void;
}) {
  useMapEvents({
    click(e) {
      if (enabled) onClick(e.latlng.lat, e.latlng.lng);
    },
  });
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

function WindCompass({
  twsKn,
  twaDeg,
  hdgDeg,
}: {
  twsKn: number;
  twaDeg: number;
  hdgDeg?: number;
}) {
  // TWA is wind angle relative to bow. Convert to absolute true bearing.
  const absoluteWindFrom = ((hdgDeg ?? 0) + twaDeg + 360) % 360;
  const size = 96;
  const r = size / 2 - 6;
  const cx = size / 2;
  const cy = size / 2;
  return (
    <div className="bg-[#070d1a]/85 backdrop-blur-md border border-white/12 rounded-2xl p-2.5 shadow-xl">
      <div className="text-[9px] uppercase tracking-widest text-white/45 font-mono mb-1 flex items-center gap-1 justify-between">
        <span className="flex items-center gap-1">
          <WindIcon className="w-3 h-3" /> True Wind
        </span>
        <span className="text-emerald-300 font-semibold">
          {twsKn.toFixed(1)} kn
        </span>
      </div>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={cx} cy={cy} r={r} fill="rgba(255,255,255,0.03)" stroke="rgba(255,255,255,0.18)" strokeWidth="1" />
        {/* N marker */}
        <text x={cx} y={10} fill="#94a3b8" fontSize="9" fontWeight="600" textAnchor="middle" fontFamily="monospace">N</text>
        {/* Cardinal ticks */}
        {[0, 90, 180, 270].map((deg) => {
          const a = ((deg - 90) * Math.PI) / 180;
          const x1 = cx + (r - 1) * Math.cos(a);
          const y1 = cy + (r - 1) * Math.sin(a);
          const x2 = cx + (r - 5) * Math.cos(a);
          const y2 = cy + (r - 5) * Math.sin(a);
          return <line key={deg} x1={x1} y1={y1} x2={x2} y2={y2} stroke="rgba(255,255,255,0.3)" strokeWidth="1" />;
        })}
        {/* Boat heading reference */}
        {hdgDeg != null && (
          <g transform={`rotate(${hdgDeg} ${cx} ${cy})`}>
            <polygon
              points={`${cx},${cy - r + 4} ${cx - 3},${cy} ${cx + 3},${cy}`}
              fill="#22d3ee"
              opacity="0.6"
            />
          </g>
        )}
        {/* Wind arrow (from direction) */}
        <g transform={`rotate(${absoluteWindFrom} ${cx} ${cy})`}>
          <line
            x1={cx}
            y1={cy - r + 2}
            x2={cx}
            y2={cy + r - 8}
            stroke="#34d399"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
          <polygon
            points={`${cx - 4},${cy + r - 12} ${cx + 4},${cy + r - 12} ${cx},${cy + r - 4}`}
            fill="#34d399"
          />
        </g>
        {/* Center dot */}
        <circle cx={cx} cy={cy} r="2.5" fill="#22d3ee" />
      </svg>
      <div className="text-center text-[10px] text-white/55 font-mono mt-0.5">
        from {Math.round(absoluteWindFrom)}° · {Math.round(((twaDeg % 360) + 360) % 360)}° rel
      </div>
    </div>
  );
}

const TRAIL_KEY = "navdash_charts_trail_v1";
const ROUTE_KEY = "navdash_charts_route_v1";
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

function bearing(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  const θ = (Math.atan2(y, x) * 180) / Math.PI;
  return (θ + 360) % 360;
}

function loadList(key: string): [number, number][] {
  try {
    const raw = localStorage.getItem(key);
    if (raw) return JSON.parse(raw);
  } catch {}
  return [];
}

function saveList(key: string, value: [number, number][]) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
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
  const [showWind, setShowWind] = useState(true);
  const [showRoute, setShowRoute] = useState(false);
  const [routeAddMode, setRouteAddMode] = useState(false);
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

  // Trail accumulation
  const [trail, setTrail] = useState<[number, number][]>(() => loadList(TRAIL_KEY));
  const lastTrailRef = useRef<[number, number] | null>(trail[trail.length - 1] ?? null);
  useEffect(() => {
    if (lat == null || lon == null) return;
    const last = lastTrailRef.current;
    if (last && haversine(last[0], last[1], lat, lon) < MIN_TRAIL_DIST_M) return;
    const pt: [number, number] = [lat, lon];
    lastTrailRef.current = pt;
    setTrail((prev) => {
      const next = [...prev, pt].slice(-MAX_TRAIL_POINTS);
      saveList(TRAIL_KEY, next);
      return next;
    });
  }, [lat, lon]);

  // Route waypoints
  const [route, setRoute] = useState<[number, number][]>(() => loadList(ROUTE_KEY));

  const addWaypoint = (la: number, lo: number) => {
    setRoute((prev) => {
      const next = [...prev, [la, lo] as [number, number]];
      saveList(ROUTE_KEY, next);
      return next;
    });
  };

  const removeWaypoint = (index: number) => {
    setRoute((prev) => {
      const next = prev.filter((_, i) => i !== index);
      saveList(ROUTE_KEY, next);
      return next;
    });
  };

  const clearRoute = () => {
    setRoute([]);
    saveList(ROUTE_KEY, []);
    setRouteAddMode(false);
  };

  // Route stats
  const routeStats = useMemo(() => {
    const legs: { distM: number; brgDeg: number }[] = [];
    let totalM = 0;

    // Include current position as the leg-0 start if we have a fix and at least one waypoint
    const points: [number, number][] = lat != null && lon != null ? [[lat, lon], ...route] : route;
    for (let i = 1; i < points.length; i++) {
      const d = haversine(points[i - 1][0], points[i - 1][1], points[i][0], points[i][1]);
      const b = bearing(points[i - 1][0], points[i - 1][1], points[i][0], points[i][1]);
      legs.push({ distM: d, brgDeg: b });
      totalM += d;
    }
    const sogMps = nav.speedOverGround;
    const etaSec = sogMps && sogMps > 0.1 ? totalM / sogMps : null;
    return { legs, totalM, etaSec };
  }, [route, lat, lon, nav.speedOverGround]);

  // Fetch RainViewer index when rain enabled
  useEffect(() => {
    if (!showRain) return;
    let cancelled = false;
    const fetchRadar = () => {
      fetch("https://api.rainviewer.com/public/weather-maps.json")
        .then((r) => r.json())
        .then((data: RainViewerData) => {
          if (!cancelled) setRainData(data);
        })
        .catch(() => {
          if (!cancelled) setRainData(null);
        });
    };
    fetchRadar();
    const id = setInterval(fetchRadar, 5 * 60 * 1000);
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

  // AIS with CPA classification
  const aisWithThreat = useMemo(() => {
    if (!showAIS) return [];
    const arr = Array.from(aisTargets.values()).filter((t) => t.position);
    return arr.map((t) => {
      const cpa = tryComputeCPAForTarget(nav, t);
      const threat = cpa ? classifyThreat(cpa) : null;
      return { target: t, cpa, threat };
    });
  }, [aisTargets, showAIS, nav]);

  const dangerCount = aisWithThreat.filter(
    (t) => t.threat?.level === "danger" || t.threat?.level === "warning",
  ).length;

  const hasGPS = lat != null && lon != null;
  const center: [number, number] = hasGPS ? [lat!, lon!] : [37.8, -122.4];

  // Build full route polyline including current position
  const routeLine: [number, number][] = useMemo(() => {
    if (route.length === 0) return [];
    if (lat != null && lon != null) return [[lat, lon], ...route];
    return route;
  }, [route, lat, lon]);

  return (
    <div className="flex flex-col h-full bg-[#070d1a]" data-testid="charts-page">
      <style>{`
        @keyframes aisPulse {
          0%, 100% { stroke-opacity: 0.4; }
          50% { stroke-opacity: 1; }
        }
      `}</style>

      <PageHeader
        title="Charts"
        icon={MapIcon}
        badge={
          dangerCount > 0 ? (
            <span className="px-2 py-0.5 rounded-full text-xs font-mono bg-red-500/15 text-red-300 border border-red-500/30 flex items-center gap-1 animate-pulse">
              <AlertTriangle className="w-3 h-3" /> {dangerCount} CPA alert{dangerCount > 1 ? "s" : ""}
            </span>
          ) : undefined
        }
      >
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
        <LayerToggle
          active={showAIS}
          onClick={() => setShowAIS((v) => !v)}
          Icon={Radio}
          label={`AIS${showAIS && aisWithThreat.length ? ` (${aisWithThreat.length})` : ""}`}
        />
        <LayerToggle
          active={showWind}
          onClick={() => setShowWind((v) => !v)}
          Icon={WindIcon}
          label="Wind"
        />
        <LayerToggle
          active={showTrail}
          onClick={() => setShowTrail((v) => !v)}
          Icon={Navigation2}
          label={`Trail${showTrail && trail.length > 1 ? ` (${trail.length})` : ""}`}
        />
        <LayerToggle
          active={showRoute}
          onClick={() => {
            setShowRoute((v) => {
              if (v) setRouteAddMode(false);
              return !v;
            });
          }}
          Icon={RouteIcon}
          label={`Route${route.length ? ` (${route.length})` : ""}`}
        />
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
          style={{
            height: "100%",
            width: "100%",
            background: "#0a1628",
            cursor: routeAddMode ? "crosshair" : undefined,
          }}
          zoomControl={true}
        >
          {baseStyle === "dark" ? (
            <TileLayer
              url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
              subdomains={["a", "b", "c", "d"]}
              maxZoom={19}
              crossOrigin
            />
          ) : (
            // CARTO Voyager: colourful OSM-style tiles that, unlike raw
            // tile.openstreetmap.org, don't get blocked when served to
            // app-style browsers (Android PWA, WebView, etc.).
            <TileLayer
              url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
              subdomains={["a", "b", "c", "d"]}
              maxZoom={19}
              crossOrigin
            />
          )}

          {showSeamarks && (
            <TileLayer
              url="https://t1.openseamap.org/seamark/{z}/{x}/{y}.png"
              attribution='&copy; <a href="https://www.openseamap.org">OpenSeaMap</a>'
              maxZoom={18}
              crossOrigin
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

          {hasGPS && <MapRecenter lat={lat!} lon={lon!} follow={follow} />}

          {showTrail && trail.length > 1 && (
            <Polyline
              positions={trail}
              pathOptions={{ color: "#06b6d4", weight: 2.5, opacity: 0.7 }}
            />
          )}

          {/* Route polyline + waypoints */}
          {showRoute && (
            <>
              <MapClickHandler enabled={routeAddMode} onClick={addWaypoint} />
              {routeLine.length > 1 && (
                <Polyline
                  positions={routeLine}
                  pathOptions={{
                    color: "#a78bfa",
                    weight: 3,
                    opacity: 0.85,
                    dashArray: "6 6",
                  }}
                />
              )}
              {route.map((wp, i) => (
                <Marker
                  key={`wp-${i}`}
                  position={wp}
                  icon={makeWaypointIcon(i, route.length)}
                  eventHandlers={{
                    click: () => removeWaypoint(i),
                  }}
                />
              ))}
            </>
          )}

          {showAIS &&
            aisWithThreat.map(({ target: t, threat }) => {
              const color = getAISShipColor(t.shipType);
              const heading = t.heading != null ? ((radToDeg(t.heading) % 360) + 360) % 360 : undefined;
              const cog = t.cog != null ? ((radToDeg(t.cog) % 360) + 360) % 360 : undefined;
              const label = t.name ?? `MMSI ${t.mmsi}`;
              const threatColor = threat && threat.level !== "none" && threat.level !== "info" ? threat.color : undefined;
              const pulse = threat?.level === "danger";
              return (
                <Marker
                  key={t.mmsi}
                  position={[t.position!.latitude, t.position!.longitude]}
                  icon={makeAISIcon({
                    color,
                    headingDeg: heading,
                    cogDeg: cog,
                    label,
                    threatColor,
                    threatPulse: pulse,
                  })}
                  title={`${label} · ${getAISShipTypeName(t.shipType)}${t.sog != null ? ` · ${mpsToKnots(t.sog).toFixed(1)}kn` : ""}`}
                />
              );
            })}

          {hasGPS && <Marker position={[lat!, lon!]} icon={makeBoatIcon(hdgDeg ?? cogDeg)} />}
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

        {/* Wind compass widget (bottom-right) */}
        {showWind && tws != null && twa != null && (
          <div className="absolute bottom-3 right-3 z-[1100] pointer-events-none">
            <WindCompass twsKn={tws} twaDeg={twa} hdgDeg={hdgDeg} />
          </div>
        )}

        {/* Route control panel (bottom-left when route layer is on) */}
        {showRoute && (
          <div className="absolute bottom-3 left-3 z-[1100] bg-[#070d1a]/90 backdrop-blur-md border border-white/12 rounded-2xl p-3 shadow-xl w-[260px]">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5 text-violet-300 text-xs font-mono uppercase tracking-widest">
                <RouteIcon className="w-3.5 h-3.5" /> Route
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setRouteAddMode((v) => !v)}
                  className={cn(
                    "flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium transition-colors border",
                    routeAddMode
                      ? "bg-violet-500/25 text-violet-200 border-violet-400/40"
                      : "bg-white/5 text-white/60 border-white/10 hover:bg-white/10"
                  )}
                >
                  <Plus className="w-3 h-3" />
                  {routeAddMode ? "Tap map…" : "Add"}
                </button>
                {route.length > 0 && (
                  <button
                    onClick={clearRoute}
                    className="flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium border bg-white/5 text-red-300/70 border-red-500/20 hover:bg-red-500/10"
                  >
                    <Trash2 className="w-3 h-3" />
                    Clear
                  </button>
                )}
              </div>
            </div>
            {route.length === 0 ? (
              <p className="text-white/40 text-[11px] leading-snug">
                Tap "Add" then click the chart to drop waypoints. Click a waypoint to remove.
              </p>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-2 text-[11px] mb-2">
                  <div className="bg-white/5 rounded-lg px-2 py-1.5">
                    <div className="text-white/40 uppercase text-[9px] tracking-widest">Total</div>
                    <div className="text-white font-mono font-semibold">{fmtNm(routeStats.totalM)}</div>
                  </div>
                  <div className="bg-white/5 rounded-lg px-2 py-1.5">
                    <div className="text-white/40 uppercase text-[9px] tracking-widest">ETA</div>
                    <div className="text-white font-mono font-semibold">
                      {routeStats.etaSec != null ? fmtTcpa(routeStats.etaSec) : "—"}
                    </div>
                  </div>
                </div>
                <div className="max-h-[120px] overflow-y-auto pr-1 space-y-1">
                  {routeStats.legs.map((leg, i) => (
                    <div key={i} className="flex items-center justify-between text-[11px] text-white/55 font-mono">
                      <span>
                        {hasGPS ? (i === 0 ? "Boat→" : `WP${i}→`) : `WP${i + 1}→`}
                        WP{i + (hasGPS ? 1 : 2)}
                      </span>
                      <span>
                        {fmtNm(leg.distM)} · {Math.round(leg.brgDeg)}°
                      </span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {/* Position chip (only if route panel not shown) */}
        {hasGPS && !showRoute && (
          <div className="pointer-events-none absolute bottom-3 left-3 z-[1100] px-3 py-1.5 rounded-lg bg-[#070d1a]/80 backdrop-blur-md border border-white/10 text-white/70 text-[11px] font-mono">
            {lat!.toFixed(5)}°, {lon!.toFixed(5)}°
          </div>
        )}

        {showRain && !rainUrl && (
          <div className="pointer-events-none absolute top-20 right-3 z-[1100] px-3 py-1.5 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-300 text-[11px]">
            Loading radar…
          </div>
        )}
      </div>
    </div>
  );
}
