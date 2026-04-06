import { useSK } from "@/lib/SignalKContext";
import { cn } from "@/lib/utils";
import { Wifi, WifiOff, AlertTriangle, RefreshCw } from "lucide-react";

export function StatusBar() {
  const { status, config, lastUpdate, error } = useSK();

  const statusConfig = {
    connected: {
      icon: Wifi,
      color: "text-emerald-400",
      bg: "bg-emerald-400/10 border-emerald-400/20",
      label: "Connected",
    },
    connecting: {
      icon: RefreshCw,
      color: "text-amber-400",
      bg: "bg-amber-400/10 border-amber-400/20",
      label: "Connecting...",
    },
    disconnected: {
      icon: WifiOff,
      color: "text-white/40",
      bg: "bg-white/5 border-white/10",
      label: "Disconnected",
    },
    error: {
      icon: AlertTriangle,
      color: "text-red-400",
      bg: "bg-red-400/10 border-red-400/20",
      label: "Error",
    },
  };

  const s = statusConfig[status];
  const Icon = s.icon;

  return (
    <div className={cn("flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs", s.bg)}>
      <Icon className={cn("w-3.5 h-3.5", status === "connecting" ? "animate-spin" : "", s.color)} />
      <span className={s.color}>{s.label}</span>
      {status === "connected" && (
        <>
          <span className="text-white/25">|</span>
          <span className="text-white/40 font-mono">
            {config.host}:{config.port}
          </span>
        </>
      )}
      {status === "error" && error && (
        <>
          <span className="text-white/25">|</span>
          <span className="text-red-300/70">{error}</span>
        </>
      )}
      {lastUpdate && status === "connected" && (
        <>
          <span className="text-white/25">|</span>
          <span className="text-white/30">
            {lastUpdate.toLocaleTimeString()}
          </span>
        </>
      )}
    </div>
  );
}
