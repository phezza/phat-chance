import { useState } from "react";
import { useSK } from "@/lib/SignalKContext";
import { mpsToKnots, radToDeg, getAISShipTypeName, getNavStatus } from "@/lib/signalk";
import { Ship, Radio, MapPin } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";

function fmt(val: number | undefined, decimals = 1): string {
  if (val == null || !Number.isFinite(val)) return "--";
  return val.toFixed(decimals);
}

function getShipTypeColor(type?: number): string {
  if (type == null) return "rgba(255,255,255,0.2)";
  if (type >= 70 && type < 80) return "#f59e0b";
  if (type >= 80 && type < 90) return "#ef4444";
  if (type >= 60 && type < 70) return "#3b82f6";
  if (type === 36 || type === 37) return "#22d3ee";
  if (type === 30) return "#22c55e";
  if (type >= 50 && type < 60) return "#a78bfa";
  return "rgba(255,255,255,0.4)";
}

function getTimeSince(timestamp: string): string {
  const diff = (Date.now() - new Date(timestamp).getTime()) / 1000;
  if (diff < 60) return `${Math.round(diff)}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  return `${Math.floor(diff / 3600)}h ago`;
}

export function AIS() {
  const { aisTargets, nav } = useSK();
  const [selected, setSelected] = useState<string | null>(null);
  const [filter, setFilter] = useState("");

  const targets = Array.from(aisTargets.values())
    .filter((t) => {
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
      if (a.timestamp && b.timestamp) {
        return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
      }
      return 0;
    });

  const selectedTarget = selected ? aisTargets.get(selected) : null;

  return (
    <div className="flex flex-col h-full" data-testid="ais-page">
      <PageHeader title="AIS Targets" icon={Radio} />
      <div className="flex flex-col gap-4 p-4 flex-1 min-h-0">
      <div className="flex items-center gap-3">
        <div className="flex-1 relative">
          <input
            type="search"
            placeholder="Search by name, MMSI, callsign..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-cyan-500/50"
            data-testid="ais-search"
          />
        </div>
        <div className="flex items-center gap-2 px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white/50">
          <Radio className="w-4 h-4 text-cyan-400" />
          <span className="text-cyan-400 font-mono font-bold">{targets.length}</span>
          <span>targets</span>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-4 flex-1 min-h-0">
        <div className="col-span-12 lg:col-span-5 overflow-y-auto rounded-xl border border-white/10 bg-white/5">
          {targets.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-white/30">
              <Radio className="w-10 h-10 mb-3 opacity-30" />
              <div className="text-sm">No AIS targets received</div>
              <div className="text-xs mt-1 opacity-60">Waiting for Signal K data...</div>
            </div>
          ) : (
            <div className="divide-y divide-white/5">
              {targets.map((target) => {
                const color = getShipTypeColor(target.shipType);
                const isSelected = selected === target.mmsi;
                return (
                  <button
                    key={target.mmsi}
                    onClick={() => setSelected(isSelected ? null : target.mmsi)}
                    className="w-full text-left px-4 py-3 hover:bg-white/5 transition-colors"
                    style={{ background: isSelected ? "rgba(34,211,238,0.05)" : undefined }}
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
                          {target.position && (
                            <span className="font-mono">
                              {target.position.latitude.toFixed(3)},{target.position.longitude.toFixed(3)}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="col-span-12 lg:col-span-7">
          {selectedTarget ? (
            <div className="bg-white/5 border border-white/10 rounded-2xl p-6 h-full">
              <div className="flex items-start gap-3 mb-6">
                <div
                  className="w-4 h-4 rounded-full mt-1 flex-shrink-0"
                  style={{ background: getShipTypeColor(selectedTarget.shipType), boxShadow: `0 0 10px ${getShipTypeColor(selectedTarget.shipType)}` }}
                />
                <div>
                  <h2 className="text-xl font-bold text-white">
                    {selectedTarget.name ?? "Unknown Vessel"}
                  </h2>
                  {selectedTarget.callsign && (
                    <p className="text-white/40 text-sm">{selectedTarget.callsign}</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="bg-white/5 rounded-xl p-3">
                  <div className="text-white/40 text-xs uppercase tracking-widest mb-1">MMSI</div>
                  <div className="font-mono text-white text-lg font-bold">{selectedTarget.mmsi}</div>
                </div>
                <div className="bg-white/5 rounded-xl p-3">
                  <div className="text-white/40 text-xs uppercase tracking-widest mb-1">Ship Type</div>
                  <div className="text-white font-semibold" style={{ color: getShipTypeColor(selectedTarget.shipType) }}>
                    {getAISShipTypeName(selectedTarget.shipType)}
                  </div>
                </div>
                <div className="bg-white/5 rounded-xl p-3">
                  <div className="text-white/40 text-xs uppercase tracking-widest mb-1">Speed</div>
                  <div className="font-mono text-white text-2xl font-bold text-cyan-400">
                    {selectedTarget.sog != null ? fmt(mpsToKnots(selectedTarget.sog)) : "--"}
                    <span className="text-sm text-white/40 ml-1">kn</span>
                  </div>
                </div>
                <div className="bg-white/5 rounded-xl p-3">
                  <div className="text-white/40 text-xs uppercase tracking-widest mb-1">Course</div>
                  <div className="font-mono text-white text-2xl font-bold text-violet-400">
                    {selectedTarget.cog != null ? fmt(radToDeg(selectedTarget.cog), 0) : "--"}
                    <span className="text-sm text-white/40 ml-1">°</span>
                  </div>
                </div>
                <div className="bg-white/5 rounded-xl p-3">
                  <div className="text-white/40 text-xs uppercase tracking-widest mb-1">Heading</div>
                  <div className="font-mono text-white text-2xl font-bold text-cyan-400">
                    {selectedTarget.heading != null ? fmt(radToDeg(selectedTarget.heading), 0) : "--"}
                    <span className="text-sm text-white/40 ml-1">°</span>
                  </div>
                </div>
                <div className="bg-white/5 rounded-xl p-3">
                  <div className="text-white/40 text-xs uppercase tracking-widest mb-1">Nav Status</div>
                  <div className="text-white font-semibold text-sm">{getNavStatus(selectedTarget.status)}</div>
                </div>
                {selectedTarget.length && (
                  <div className="bg-white/5 rounded-xl p-3">
                    <div className="text-white/40 text-xs uppercase tracking-widest mb-1">Length</div>
                    <div className="font-mono text-white font-bold">
                      {selectedTarget.length}m
                      {selectedTarget.beam && <span className="text-white/40"> × {selectedTarget.beam}m</span>}
                    </div>
                  </div>
                )}
                {selectedTarget.position && (
                  <div className="col-span-2 bg-white/5 rounded-xl p-3">
                    <div className="text-white/40 text-xs uppercase tracking-widest mb-1 flex items-center gap-1">
                      <MapPin className="w-3 h-3" /> Position
                    </div>
                    <div className="font-mono text-white text-sm">
                      {selectedTarget.position.latitude.toFixed(5)}°{" "}
                      {selectedTarget.position.longitude.toFixed(5)}°
                    </div>
                    {nav.position && (
                      <div className="text-white/30 text-xs mt-1">
                        {(() => {
                          const dlat = (selectedTarget.position!.latitude - nav.position!.latitude) * 111.32;
                          const dlon = (selectedTarget.position!.longitude - nav.position!.longitude) * 111.32 * Math.cos(nav.position!.latitude * Math.PI / 180);
                          const dist = Math.sqrt(dlat * dlat + dlon * dlon) / 1.852;
                          return `~${dist.toFixed(1)} NM away`;
                        })()}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-white/5 border border-white/10 rounded-2xl h-full flex flex-col items-center justify-center text-white/30">
              <Ship className="w-16 h-16 mb-4 opacity-20" />
              <p className="text-sm">Select a target for details</p>
            </div>
          )}
        </div>
      </div>
      </div>
    </div>
  );
}
