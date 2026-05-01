import { useState } from "react";
import { useSK } from "@/lib/SignalKContext";
import { SignalKConfig, ConnectionMode } from "@/lib/signalk";
import { Wifi, WifiOff, Save, RotateCcw, Radio, Server, Anchor, Settings as SettingsIcon, Sun } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { cn } from "@/lib/utils";
import { useWakeLock } from "@/lib/useWakeLock";

export function Settings() {
  const { config, updateConfig, status, connect, disconnect, nav, aisTargets, rawState, nmeaLog, parseStats } = useSK();
  const wakeLock = useWakeLock();
  const [form, setForm] = useState<SignalKConfig>({ ...config });
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    updateConfig(form);
    connect(form);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleReset = () => {
    setForm({ ...config });
  };

  const setMode = (mode: ConnectionMode) => setForm((prev) => ({ ...prev, mode }));

  const rawEntries = Object.entries(rawState)
    .filter(([key]) => key.includes("vessels.self"))
    .map(([key, val]) => ({ path: key.replace(/^vessels\.self\./, ""), value: val.value, timestamp: val.timestamp }))
    .sort((a, b) => a.path.localeCompare(b.path));

  const statusColor = { connected: "#22d3ee", connecting: "#f59e0b", disconnected: "rgba(255,255,255,0.4)", error: "#ef4444" }[status];

  return (
    <div className="flex flex-col" data-testid="settings-page">
      <PageHeader title="Settings" icon={SettingsIcon} />
      <div className="flex flex-col gap-6 p-4 max-w-3xl mx-auto">
      <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
        <h2 className="text-white font-bold text-lg mb-4 flex items-center gap-2">
          <Wifi className="w-5 h-5 text-cyan-400" />
          Connection Settings
        </h2>

        <div className="mb-5">
          <label className="text-white/40 uppercase tracking-widest text-xs block mb-3">Connection Mode</label>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => setMode("signalk")}
              className={cn(
                "flex flex-col items-center gap-2 p-4 rounded-xl border text-sm font-medium transition-all",
                form.mode === "signalk"
                  ? "bg-cyan-500/15 border-cyan-500/40 text-cyan-400"
                  : "bg-white/5 border-white/10 text-white/50 hover:border-white/20 hover:text-white/70"
              )}
              data-testid="mode-signalk"
            >
              <Server className="w-6 h-6" />
              <span>Signal K Server</span>
              <span className="text-xs opacity-60 font-normal text-center">WebSocket to Signal K / NavLink2 Signal K port</span>
            </button>
            <button
              onClick={() => setMode("nmea-tcp")}
              className={cn(
                "flex flex-col items-center gap-2 p-4 rounded-xl border text-sm font-medium transition-all",
                form.mode === "nmea-tcp"
                  ? "bg-violet-500/15 border-violet-500/40 text-violet-400"
                  : "bg-white/5 border-white/10 text-white/50 hover:border-white/20 hover:text-white/70"
              )}
              data-testid="mode-nmea-tcp"
            >
              <Anchor className="w-6 h-6" />
              <span>Direct NMEA TCP</span>
              <span className="text-xs opacity-60 font-normal text-center">Raw NMEA 0183 stream from NavLink2 TCP port</span>
            </button>
          </div>
        </div>

        {form.mode === "signalk" && (
          <>
            <div className="text-white/30 text-xs mb-3 px-1">
              Signal K mode connects to the NavLink2's Signal K server (typically port 3000) via WebSocket and receives structured data.
            </div>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="text-white/40 uppercase tracking-widest text-xs block mb-2">Host / IP Address</label>
                <input
                  type="text"
                  value={form.host}
                  onChange={(e) => setForm({ ...form, host: e.target.value })}
                  placeholder="192.168.1.1"
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white font-mono text-sm focus:outline-none focus:border-cyan-500/50"
                  data-testid="input-sk-host"
                />
              </div>
              <div>
                <label className="text-white/40 uppercase tracking-widest text-xs block mb-2">Port</label>
                <input
                  type="number"
                  value={form.port}
                  onChange={(e) => setForm({ ...form, port: Number(e.target.value) })}
                  placeholder="3000"
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white font-mono text-sm focus:outline-none focus:border-cyan-500/50"
                  data-testid="input-sk-port"
                />
              </div>
            </div>
            <label className="flex items-center gap-2 cursor-pointer mb-4">
              <input
                type="checkbox"
                checked={form.useTLS}
                onChange={(e) => setForm({ ...form, useTLS: e.target.checked })}
                className="rounded"
                data-testid="input-tls"
              />
              <span className="text-white/60 text-sm">Use TLS (wss://)</span>
            </label>
          </>
        )}

        {form.mode === "nmea-tcp" && (
          <>
            <div className="text-white/30 text-xs mb-3 px-1">
              Direct TCP mode connects to the NavLink2's raw NMEA TCP port (typically 10110) and parses NMEA 0183 sentences. No Signal K installation needed. The NavDash proxy server handles the TCP connection.
            </div>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="text-white/40 uppercase tracking-widest text-xs block mb-2">NavLink2 Host / IP</label>
                <input
                  type="text"
                  value={form.nmeaHost}
                  onChange={(e) => setForm({ ...form, nmeaHost: e.target.value })}
                  placeholder="192.168.1.1"
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white font-mono text-sm focus:outline-none focus:border-violet-500/50"
                  data-testid="input-nmea-host"
                />
              </div>
              <div>
                <label className="text-white/40 uppercase tracking-widest text-xs block mb-2">TCP Port</label>
                <input
                  type="number"
                  value={form.nmeaPort}
                  onChange={(e) => setForm({ ...form, nmeaPort: Number(e.target.value) })}
                  placeholder="10110"
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white font-mono text-sm focus:outline-none focus:border-violet-500/50"
                  data-testid="input-nmea-port"
                />
              </div>
            </div>
            <div className="bg-violet-500/5 border border-violet-500/20 rounded-lg p-3 mb-4 text-xs text-violet-300/70">
              <strong className="text-violet-300">NavLink2 TCP defaults:</strong> NMEA 0183 server usually runs on port 10110. Check the NavLink2 web interface under Network &gt; TCP Connections for the exact port and make sure NMEA output is enabled.
            </div>
          </>
        )}

        <div className="flex gap-3">
          <button
            onClick={handleSave}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors border",
              form.mode === "nmea-tcp"
                ? "bg-violet-500/20 border-violet-500/40 text-violet-400 hover:bg-violet-500/30"
                : "bg-cyan-500/20 border-cyan-500/40 text-cyan-400 hover:bg-cyan-500/30"
            )}
            data-testid="button-save"
          >
            <Save className="w-4 h-4" />
            {saved ? "Saved!" : "Save & Connect"}
          </button>
          <button
            onClick={handleReset}
            className="flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 text-white/50 rounded-lg text-sm hover:bg-white/10 transition-colors"
            data-testid="button-reset"
          >
            <RotateCcw className="w-4 h-4" />
            Reset
          </button>
          {status === "connected" ? (
            <button
              onClick={disconnect}
              className="flex items-center gap-2 px-4 py-2 bg-red-500/10 border border-red-500/30 text-red-400 rounded-lg text-sm hover:bg-red-500/20 transition-colors ml-auto"
              data-testid="button-disconnect"
            >
              <WifiOff className="w-4 h-4" />
              Disconnect
            </button>
          ) : (
            <button
              onClick={() => connect(config)}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-lg text-sm hover:bg-emerald-500/20 transition-colors ml-auto"
              data-testid="button-connect"
            >
              <Wifi className="w-4 h-4" />
              Connect
            </button>
          )}
        </div>
      </div>

      <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
        <h2 className="text-white font-bold text-lg mb-4 flex items-center gap-2">
          <Sun className="w-5 h-5 text-amber-400" />
          Display
        </h2>
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={wakeLock.enabled}
            onChange={wakeLock.toggle}
            disabled={!wakeLock.supported}
            className="mt-1 rounded"
            data-testid="input-wake-lock"
          />
          <div className="flex-1">
            <div className="text-white text-sm font-medium flex items-center gap-2">
              Keep screen on while dashboard is open
              {wakeLock.enabled && wakeLock.active && (
                <span className="text-emerald-400 text-xs font-normal">● active</span>
              )}
              {wakeLock.enabled && !wakeLock.active && wakeLock.supported && (
                <span className="text-amber-400 text-xs font-normal">waiting for tab focus</span>
              )}
            </div>
            <div className="text-white/40 text-xs mt-1">
              {wakeLock.supported
                ? "Prevents the device from sleeping while this tab is visible. Useful when the tablet is mounted as a chartplotter."
                : "Your browser doesn't support the Wake Lock API. On Android, use Chrome. On iOS 16.4+, use Safari."}
            </div>
            {wakeLock.error && (
              <div className="text-red-400/70 text-xs mt-1">Wake lock error: {wakeLock.error}</div>
            )}
          </div>
        </label>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white/5 border border-white/10 rounded-xl p-4">
          <div className="text-white/40 text-xs uppercase tracking-widest mb-2">Connection</div>
          <div className="text-sm font-bold capitalize" style={{ color: statusColor }}>{status}</div>
          <div className="text-white/25 text-xs mt-1">{config.mode === "nmea-tcp" ? "Direct NMEA TCP" : "Signal K"}</div>
        </div>
        <div className="bg-white/5 border border-white/10 rounded-xl p-4">
          <div className="text-white/40 text-xs uppercase tracking-widest mb-2">AIS Targets</div>
          <div className="text-3xl font-bold font-mono text-violet-400">{aisTargets.size}</div>
        </div>
        <div className="bg-white/5 border border-white/10 rounded-xl p-4">
          <div className="text-white/40 text-xs uppercase tracking-widest mb-2">{config.mode === "nmea-tcp" ? "NMEA Sentences" : "Data Paths"}</div>
          <div className="text-3xl font-bold font-mono text-cyan-400">
            {config.mode === "nmea-tcp" ? (parseStats?.total ?? 0) : rawEntries.length}
          </div>
        </div>
      </div>

      {config.mode === "nmea-tcp" && parseStats && parseStats.total > 0 && (
        <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
          <div className="px-4 py-3 border-b border-white/10 flex items-center gap-2">
            <Radio className="w-4 h-4 text-cyan-400" />
            <h3 className="text-white/60 text-sm font-medium">Parser Diagnostics</h3>
          </div>
          <div className="grid grid-cols-4 gap-px bg-white/5">
            <div className="bg-[#0a1320] p-3">
              <div className="text-white/40 text-[10px] uppercase tracking-widest">Received</div>
              <div className="text-2xl font-mono font-bold text-white">{parseStats.total}</div>
            </div>
            <div className="bg-[#0a1320] p-3">
              <div className="text-white/40 text-[10px] uppercase tracking-widest">Parsed (data)</div>
              <div className="text-2xl font-mono font-bold text-emerald-400">{parseStats.withData}</div>
            </div>
            <div className="bg-[#0a1320] p-3">
              <div className="text-white/40 text-[10px] uppercase tracking-widest">Unknown type</div>
              <div className="text-2xl font-mono font-bold text-amber-400">{parseStats.total - parseStats.recognised}</div>
            </div>
            <div className="bg-[#0a1320] p-3">
              <div className="text-white/40 text-[10px] uppercase tracking-widest">Bad checksum</div>
              <div className="text-2xl font-mono font-bold text-red-400">{parseStats.badChecksum}</div>
            </div>
          </div>
          <div className="p-3 border-t border-white/10 bg-black/20">
            <div className="text-white/40 text-[10px] uppercase tracking-widest mb-2">Sentence types received</div>
            <div className="flex flex-wrap gap-1.5">
              {Object.entries(parseStats.byType)
                .sort((a, b) => b[1].count - a[1].count)
                .map(([type, s]) => {
                  const known = s.parsed > 0;
                  return (
                    <span
                      key={type}
                      className={cn(
                        "px-2 py-1 rounded text-xs font-mono border",
                        known
                          ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
                          : "bg-white/5 border-white/10 text-white/40"
                      )}
                      title={`${s.parsed}/${s.count} produced data`}
                    >
                      {type} <span className="opacity-60">×{s.count}</span>
                    </span>
                  );
                })}
            </div>
            <div className="text-white/30 text-[10px] mt-3 leading-relaxed">
              <span className="text-emerald-400">Green</span> = parsed and produced data ·
              <span className="text-white/40"> Gray</span> = received but not handled by the parser.
              If a sentence type you expect is gray, paste an example to add support.
            </div>
          </div>
        </div>
      )}

      {config.mode === "nmea-tcp" && nmeaLog && nmeaLog.length > 0 && (
        <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
          <div className="px-4 py-3 border-b border-white/10 flex items-center gap-2">
            <Radio className="w-4 h-4 text-violet-400" />
            <h3 className="text-white/60 text-sm font-medium">Live NMEA Stream</h3>
          </div>
          <div className="max-h-64 overflow-y-auto p-3 font-mono text-xs bg-black/30 space-y-0.5">
            {nmeaLog.map((entry, i) => {
              const colorClass =
                entry.status === "data"
                  ? "text-emerald-400"
                  : entry.status === "parsed-empty"
                  ? "text-cyan-400/60"
                  : entry.status === "bad-checksum"
                  ? "text-red-400/70"
                  : "text-white/30";
              return (
                <div key={i} className={cn("leading-5", colorClass)} title={entry.status}>
                  {entry.sentence}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {config.mode === "signalk" && (
        <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
          <div className="px-4 py-3 border-b border-white/10">
            <h3 className="text-white/60 text-sm font-medium">Live Data Paths (own vessel)</h3>
          </div>
          <div className="max-h-96 overflow-y-auto">
            {rawEntries.length === 0 ? (
              <div className="p-6 text-center text-white/30 text-sm">No data received yet</div>
            ) : (
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-black/50 backdrop-blur">
                  <tr>
                    <th className="text-left px-4 py-2 text-white/30 font-medium w-1/2">Path</th>
                    <th className="text-left px-4 py-2 text-white/30 font-medium w-1/3">Value</th>
                    <th className="text-left px-4 py-2 text-white/30 font-medium">Updated</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {rawEntries.map(({ path, value, timestamp }) => (
                    <tr key={path} className="hover:bg-white/5">
                      <td className="px-4 py-2 font-mono text-cyan-400/70">{path}</td>
                      <td className="px-4 py-2 font-mono text-white/60 truncate max-w-0">
                        {typeof value === "object" ? JSON.stringify(value) : String(value)}
                      </td>
                      <td className="px-4 py-2 text-white/30">{new Date(timestamp).toLocaleTimeString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </div>
    </div>
  );
}
