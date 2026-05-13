import { useEffect, useMemo, useRef, useState } from "react";
import { MapContainer, TileLayer, Marker, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useSK } from "@/lib/SignalKContext";
import { mpsToKnots, radToDeg, getAISShipTypeName, getNavStatus } from "@/lib/signalk";
import { Ship, Radio, MapPin, X, AlertTriangle } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { makeBoatIcon, makeAISIcon, getAISShipColor } from "@/lib/mapIcons";
import { tryComputeCPAForTarget, classifyThreat, fmtNm, fmtTcpa } from "@/lib/cpa";
import { cn } from "@/lib/utils";

function fmt(val: number | undefined, decimals = 1): string {
  if (val == null || !Number.isFinite(val)) return "--";
  return val.toFixed(decimals);
}

function getTimeSince(timestamp: string): string {
  const diff = (Date.now() - new Date(timestamp).getTime()) / 1000;
  if (diff < 60) return `${Math.round(diff)}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  return `${Math.floor(diff / 3600)}h ago`;
}

function FocusOnTarget({
  target,
}: {
  target: { latitude: number; longitude: number } | null;
}) {
  const map = useMap();
  useEffect(() => {
    setTimeout(() => map.invalidateSize(), 0);
  }, [map]);
  useEffect(() => {
    if (!target) return;
    map.flyTo([target.latitude, target.longitude], Math.max(map.getZoom(), 13), {
      animate: true,
      duration: 0.6,
    });
  }, [target, map]);
  return null;
}

function FitInitial({
  bounds,
}: {
  bounds: L.LatLngBoundsExpression | null;
}) {
  const map = useMap();
  const done = useRef(false);
  useEffect(() => {
    if (done.current) return;
    if (!bounds) return;
    map.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 });
    done.current = true;
  }, [bounds, map]);
  return null;
}

export function AIS() {
  const { aisTargets, nav } = useSK();
  const [selected, setSelected] = useState<string | null>(null);
  const [filter, setFilter] = useState("");
  const [focusKey, setFocusKey] = useState(0);

  // Compute CPA for every target up-front so we can sort/badge by threat
  const enriched = useMemo(() => {
    return Array.from(aisTargets.values()).map((t) => {
      const cpa = tryComputeCPAForTarget(nav, t);
      const threat = cpa ? classifyThreat(cpa) : null;
      return { target: t, cpa, threat };
    });
  }, [aisTargets, nav]);

  const threatRank: Record<string, number> = {
    danger: 4,
    warning: 3,
    caution: 2,
    info: 1,
    none: 0,
  };

  const targets = useMemo(() => {
    return enriched
      .filter(({ target: t }) => {
        if (!filter) return true;
        const q = filter.toLowerCase();
        return (
          t.mmsi.includes(q) ||
          t.name?.toLowerCase().includes(q) ||
          t.callsign?.toLowerCase().includes(q) ||
          getAISShipTypeName(t.shipType).toLowerCase().includes(q)
        );
      })
      .sort((a, b) => {
        const ra = a.threat ? threatRank[a.threat.level] : 0;
        const rb = b.threat ? threatRank[b.threat.level] : 0;
        if (ra !== rb) return rb - ra;
        if (a.target.timestamp && b.target.timestamp) {
          return new Date(b.target.timestamp).getTime() - new Date(a.target.timestamp).getTime();
        }
        return 0;
      });
  }, [enriched, filter]);

  const selectedTarget = selected ? aisTargets.get(selected) : null;
  const selectedCPA = useMemo(
    () => (selectedTarget ? tryComputeCPAForTarget(nav, selectedTarget) : null),
    [selectedTarget, nav],
  );
  const selectedThreat = selectedCPA ? classifyThreat(selectedCPA) : null;

  const dangerCount = enriched.filter(
    (t) => t.threat?.level === "danger" || t.threat?.level === "warning",
  ).length;

  // Compute initial bounds covering boat + AIS targets
  const positionedTargets = useMemo(
    () => Array.from(aisTargets.values()).filter((t) => t.position),
    [aisTargets]
  );

  const initialBounds = useMemo(() => {
    const pts: L.LatLngTuple[] = [];
    if (nav.position) pts.push([nav.position.latitude, nav.position.longitude]);
    for (const t of positionedTargets) {
      pts.push([t.position!.latitude, t.position!.longitude]);
    }
    if (pts.length === 0) return null;
    if (pts.length === 1) {
      const [la, lo] = pts[0];
      return L.latLngBounds([la - 0.05, lo - 0.05], [la + 0.05, lo + 0.05]);
    }
    return L.latLngBounds(pts);
  }, [positionedTargets, nav.position]);

  const focusPos = useMemo(() => {
    if (!selectedTarget?.position) return null;
    return {
      latitude: selectedTarget.position.latitude,
      longitude: selectedTarget.position.longitude,
    };
  }, [selectedTarget?.position?.latitude, selectedTarget?.position?.longitude]);

  // Re-focus the map every time user clicks the same target again
  useEffect(() => {
    setFocusKey((k) => k + 1);
  }, [selected]);

  const fallbackCenter: [number, number] = nav.position
    ? [nav.position.latitude, nav.position.longitude]
    : [37.8, -122.4];

  return (
    <div className="flex flex-col h-full" data-testid="ais-page">
      <PageHeader title="AIS Targets" icon={Radio} badge={
        <>
          <span className="px-2 py-0.5 rounded-full text-xs font-mono bg-cyan-500/15 text-cyan-300 border border-cyan-500/25">
            {aisTargets.size} total · {positionedTargets.length} on map
          </span>
          {dangerCount > 0 && (
            <span className="px-2 py-0.5 rounded-full text-xs font-mono bg-red-500/15 text-red-300 border border-red-500/30 flex items-center gap-1 animate-pulse">
              <AlertTriangle className="w-3 h-3" /> {dangerCount} CPA alert{dangerCount > 1 ? "s" : ""}
            </span>
          )}
        </>
      } />

      <div className="flex-shrink-0 px-4 py-2.5 border-b border-white/8 bg-black/20">
        <input
          type="search"
          placeholder="Search by name, MMSI, callsign…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-cyan-500/50"
          data-testid="ais-search"
        />
      </div>

      <div className="grid grid-cols-12 flex-1 min-h-0">
        {/* Target list */}
        <div className="col-span-12 lg:col-span-4 xl:col-span-3 overflow-y-auto border-r border-white/8 bg-black/20">
          {targets.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-white/30 px-4 text-center">
              <Radio className="w-10 h-10 mb-3 opacity-30" />
              <div className="text-sm">No AIS targets received</div>
              <div className="text-xs mt-1 opacity-60">Waiting for Signal K data…</div>
            </div>
          ) : (
            <div className="divide-y divide-white/5">
              {targets.map(({ target, threat, cpa }) => {
                const color = getAISShipColor(target.shipType);
                const isSelected = selected === target.mmsi;
                const showThreat = threat && threat.level !== "none" && threat.level !== "info";
                return (
                  <button
                    key={target.mmsi}
                    onClick={() => setSelected(isSelected ? null : target.mmsi)}
                    className={cn(
                      "w-full text-left px-4 py-3 hover:bg-white/5 transition-colors",
                      isSelected && "bg-cyan-500/10"
                    )}
                    style={
                      showThreat && threat
                        ? { borderLeft: `3px solid ${threat.color}`, paddingLeft: "13px" }
                        : undefined
                    }
                    data-testid={`ais-target-${target.mmsi}`}
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className="mt-1 w-2.5 h-2.5 rounded-full flex-shrink-0"
                        style={{ background: color, boxShadow: `0 0 6px ${color}` }}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-semibold text-white text-sm truncate">
                            {target.name ?? `MMSI ${target.mmsi}`}
                          </span>
                          {target.timestamp && (
                            <span className="text-white/30 text-xs flex-shrink-0">
                              {getTimeSince(target.timestamp)}
                            </span>
                          )}
                        </div>
                        <div className="text-white/40 text-xs mt-0.5 flex items-center gap-2">
                          <span>{getAISShipTypeName(target.shipType)}</span>
                          <span>·</span>
                          <span className="font-mono">{target.mmsi}</span>
                        </div>
                        <div className="flex items-center gap-3 mt-1 text-xs text-white/35">
                          {target.sog != null && (
                            <span>{mpsToKnots(target.sog).toFixed(1)} kn</span>
                          )}
                          {target.cog != null && (
                            <span>{radToDeg(target.cog).toFixed(0)}°</span>
                          )}
                          {!target.position && (
                            <span className="text-amber-400/70">no position</span>
                          )}
                        </div>
                        {showThreat && threat && cpa && (
                          <div
                            className="mt-1 inline-flex items-center gap-1 text-[10px] font-mono px-1.5 py-0.5 rounded"
                            style={{
                              background: `${threat.color}1f`,
                              color: threat.color,
                              border: `1px solid ${threat.color}40`,
                            }}
                          >
                            <AlertTriangle className="w-3 h-3" />
                            CPA {fmtNm(cpa.cpaMeters)} · {fmtTcpa(cpa.tcpaSeconds)}
                          </div>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Map */}
        <div className="col-span-12 lg:col-span-8 xl:col-span-9 relative min-h-[400px]">
          <MapContainer
            center={fallbackCenter}
            zoom={11}
            style={{ height: "100%", width: "100%", background: "#0a1628" }}
            zoomControl={true}
          >
            <TileLayer
              url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
              subdomains={["a", "b", "c", "d"]}
              maxZoom={19}
              crossOrigin
            />
            <TileLayer
              url="https://t1.openseamap.org/seamark/{z}/{x}/{y}.png"
              attribution='&copy; <a href="https://www.openseamap.org">OpenSeaMap</a>'
              maxZoom={18}
              crossOrigin
            />

            <FitInitial bounds={initialBounds} />
            <FocusOnTarget key={focusKey} target={focusPos} />

            {enriched
              .filter(({ target }) => target.position)
              .map(({ target: t, threat }) => {
                const color = getAISShipColor(t.shipType);
                const heading = t.heading != null ? ((radToDeg(t.heading) % 360) + 360) % 360 : undefined;
                const cog = t.cog != null ? ((radToDeg(t.cog) % 360) + 360) % 360 : undefined;
                const isSel = selected === t.mmsi;
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
                      selected: isSel,
                      label,
                      threatColor,
                      threatPulse: pulse,
                    })}
                    eventHandlers={{
                      click: () => setSelected(isSel ? null : t.mmsi),
                    }}
                  />
                );
              })}

            {nav.position && (
              <Marker
                position={[nav.position.latitude, nav.position.longitude]}
                icon={makeBoatIcon(
                  nav.headingTrue != null
                    ? radToDeg(nav.headingTrue)
                    : nav.headingMagnetic != null
                      ? radToDeg(nav.headingMagnetic)
                      : undefined
                )}
              />
            )}
          </MapContainer>

          {/* Detail panel overlay */}
          {selectedTarget && (
            <div className="absolute top-3 right-3 z-[1100] w-[320px] max-w-[calc(100%-24px)] bg-[#070d1a]/92 backdrop-blur-md border border-white/12 rounded-2xl p-4 shadow-2xl">
              <div className="flex items-start gap-3 mb-4">
                <div
                  className="w-3.5 h-3.5 rounded-full mt-1 flex-shrink-0"
                  style={{
                    background: getAISShipColor(selectedTarget.shipType),
                    boxShadow: `0 0 10px ${getAISShipColor(selectedTarget.shipType)}`,
                  }}
                />
                <div className="flex-1 min-w-0">
                  <h2 className="text-base font-bold text-white truncate">
                    {selectedTarget.name ?? "Unknown Vessel"}
                  </h2>
                  <p className="text-white/40 text-xs">
                    {getAISShipTypeName(selectedTarget.shipType)}
                    {selectedTarget.callsign && ` · ${selectedTarget.callsign}`}
                  </p>
                </div>
                <button
                  onClick={() => setSelected(null)}
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-white/40 hover:text-white hover:bg-white/10"
                  aria-label="Close"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <Field label="MMSI" value={selectedTarget.mmsi} mono />
                <Field label="Status" value={getNavStatus(selectedTarget.status)} />
                <Field
                  label="Speed"
                  value={selectedTarget.sog != null ? `${fmt(mpsToKnots(selectedTarget.sog))} kn` : "—"}
                  color="#22d3ee"
                />
                <Field
                  label="Course"
                  value={selectedTarget.cog != null ? `${fmt(radToDeg(selectedTarget.cog), 0)}°` : "—"}
                  color="#a78bfa"
                />
                <Field
                  label="Heading"
                  value={selectedTarget.heading != null ? `${fmt(radToDeg(selectedTarget.heading), 0)}°` : "—"}
                  color="#22d3ee"
                />
                {selectedTarget.length && (
                  <Field
                    label="Size"
                    value={`${selectedTarget.length}${selectedTarget.beam ? `×${selectedTarget.beam}` : ""} m`}
                  />
                )}
                {selectedTarget.position && (
                  <div className="col-span-2 bg-white/5 rounded-lg p-2">
                    <div className="text-white/40 uppercase tracking-widest text-[10px] mb-0.5 flex items-center gap-1">
                      <MapPin className="w-3 h-3" /> Position
                    </div>
                    <div className="font-mono text-white text-xs">
                      {selectedTarget.position.latitude.toFixed(5)}°, {selectedTarget.position.longitude.toFixed(5)}°
                    </div>
                    {selectedCPA && (
                      <div className="text-white/40 text-[11px] mt-0.5">
                        {fmtNm(selectedCPA.distanceMeters)} · {Math.round(selectedCPA.bearingDeg)}° from boat
                      </div>
                    )}
                  </div>
                )}

                {selectedCPA && selectedThreat && (
                  <div
                    className="col-span-2 rounded-lg p-2 border"
                    style={{
                      background: selectedThreat.level === "none" ? "rgba(255,255,255,0.04)" : `${selectedThreat.color}15`,
                      borderColor:
                        selectedThreat.level === "none"
                          ? "rgba(255,255,255,0.08)"
                          : `${selectedThreat.color}40`,
                    }}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <div className="text-white/45 uppercase tracking-widest text-[10px] flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" /> Collision Risk (CPA)
                      </div>
                      {selectedThreat.label && (
                        <span
                          className="text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider"
                          style={{ color: selectedThreat.color, background: `${selectedThreat.color}22` }}
                        >
                          {selectedThreat.label}
                        </span>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-2 mt-1.5">
                      <div>
                        <div className="text-white/35 text-[10px] uppercase tracking-widest">CPA</div>
                        <div className="text-white font-mono font-semibold">{fmtNm(selectedCPA.cpaMeters)}</div>
                      </div>
                      <div>
                        <div className="text-white/35 text-[10px] uppercase tracking-widest">TCPA</div>
                        <div className="text-white font-mono font-semibold">{fmtTcpa(selectedCPA.tcpaSeconds)}</div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {!selectedTarget && positionedTargets.length === 0 && (
            <div className="absolute inset-0 z-[400] flex flex-col items-center justify-center text-white/30 pointer-events-none">
              <Ship className="w-12 h-12 mb-3 opacity-30" />
              <p className="text-sm">No AIS targets with positions</p>
              <p className="text-xs mt-1 opacity-60">
                Waiting for vessel positions on the network…
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  mono,
  color,
}: {
  label: string;
  value: string;
  mono?: boolean;
  color?: string;
}) {
  return (
    <div className="bg-white/5 rounded-lg p-2">
      <div className="text-white/40 uppercase tracking-widest text-[10px] mb-0.5">{label}</div>
      <div
        className={cn("text-white font-semibold text-sm", mono && "font-mono")}
        style={color ? { color } : undefined}
      >
        {value}
      </div>
    </div>
  );
}
