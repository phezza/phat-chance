import { useState } from "react";
import { useSK } from "@/lib/SignalKContext";
import { SignalKConfig } from "@/lib/signalk";
import { Wifi, WifiOff, Save, RotateCcw } from "lucide-react";

export function Settings() {
  const { config, updateConfig, status, connect, disconnect, nav, aisTargets, rawState } = useSK();
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

  const rawEntries = Object.entries(rawState)
    .filter(([key]) => key.includes("vessels.self"))
    .map(([key, val]) => ({ path: key.replace(/^vessels\.self\./, ""), value: val.value, timestamp: val.timestamp }))
    .sort((a, b) => a.path.localeCompare(b.path));

  return (
    <div className="flex flex-col gap-6 p-4 max-w-3xl mx-auto" data-testid="settings-page">
      <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
        <h2 className="text-white font-bold text-lg mb-4 flex items-center gap-2">
          <Wifi className="w-5 h-5 text-cyan-400" />
          Signal K Connection
        </h2>

        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <label className="text-white/40 uppercase tracking-widest text-xs block mb-2">Host / IP Address</label>
            <input
              type="text"
              value={form.host}
              onChange={(e) => setForm({ ...form, host: e.target.value })}
              placeholder="192.168.1.1"
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white font-mono text-sm focus:outline-none focus:border-cyan-500/50"
              data-testid="input-host"
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
              data-testid="input-port"
            />
          </div>
        </div>

        <div className="flex items-center gap-3 mb-6">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={form.useTLS}
              onChange={(e) => setForm({ ...form, useTLS: e.target.checked })}
              className="rounded"
              data-testid="input-tls"
            />
            <span className="text-white/60 text-sm">Use TLS (wss://)</span>
          </label>
        </div>

        <div className="flex gap-3">
          <button
            onClick={handleSave}
            className="flex items-center gap-2 px-4 py-2 bg-cyan-500/20 border border-cyan-500/40 text-cyan-400 rounded-lg text-sm font-medium hover:bg-cyan-500/30 transition-colors"
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

      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white/5 border border-white/10 rounded-xl p-4">
          <div className="text-white/40 text-xs uppercase tracking-widest mb-2">Data Paths Received</div>
          <div className="text-3xl font-bold font-mono text-cyan-400">{rawEntries.length}</div>
        </div>
        <div className="bg-white/5 border border-white/10 rounded-xl p-4">
          <div className="text-white/40 text-xs uppercase tracking-widest mb-2">AIS Targets</div>
          <div className="text-3xl font-bold font-mono text-violet-400">{aisTargets.size}</div>
        </div>
        <div className="bg-white/5 border border-white/10 rounded-xl p-4">
          <div className="text-white/40 text-xs uppercase tracking-widest mb-2">Connection</div>
          <div className="text-sm font-bold capitalize" style={{ color: status === "connected" ? "#22d3ee" : status === "error" ? "#ef4444" : "rgba(255,255,255,0.4)" }}>
            {status}
          </div>
        </div>
      </div>

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
                    <td className="px-4 py-2 text-white/30">
                      {new Date(timestamp).toLocaleTimeString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
