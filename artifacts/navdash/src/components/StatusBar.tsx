import { useSK } from "@/lib/SignalKContext";
import { cn } from "@/lib/utils";
import { Wifi, WifiOff, AlertTriangle, RefreshCw, Anchor } from "lucide-react";

interface StatusBarProps {
  compact?: boolean;
}

export function StatusBar({ compact = false }: StatusBarProps) {
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
      label: "Connecting",
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
  const isNMEA = config.mode === "nmea-tcp";
  const host = isNMEA ? config.nmeaHost : config.host;
  const port = isNMEA ? config.nmeaPort : config.port;

  if (compact) {
    return (
      <div
        className={cn("w-8 h-8 rounded-lg flex items-center justify-center border", s.bg)}
        title={`${s.label}${status === "error" && error ? ": " + error : ""}`}
      >
        {isNMEA && status !== "error" ? (
          <Anchor className={cn("w-3.5 h-3.5", s.color)} />
        ) : (
          <Icon className={cn("w-3.5 h-3.5", status === "connecting" ? "animate-spin" : "", s.color)} />
        )}
      </div>
    );
  }

  return (
    <div className={cn("flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs min-w-0 max-w-full overflow-hidden", s.bg)}>
      {isNMEA && status !== "error" ? (
        <Anchor className={cn("w-3.5 h-3.5 flex-shrink-0", s.color)} />
      ) : (
        <Icon className={cn("w-3.5 h-3.5 flex-shrink-0", status === "connecting" ? "animate-spin" : "", s.color)} />
      )}
      <span className={cn("flex-shrink-0", s.color)}>{s.label}</span>

      {status === "connected" && (
        <>
          <span className="text-white/20 flex-shrink-0">·</span>
          <span className="text-white/40 font-mono flex-shrink-0 hidden sm:inline">{host}:{port}</span>
          <span className="text-white/20 flex-shrink-0 hidden sm:inline">·</span>
          <span className="text-white/30 flex-shrink-0 hidden sm:inline">{isNMEA ? "NMEA" : "SK"}</span>
        </>
      )}

      {status === "error" && error && (
        <>
          <span className="text-white/20 flex-shrink-0">·</span>
          <div className="overflow-hidden flex-1 min-w-0 max-w-[180px]">
            <div className="marquee-container">
              <span className="marquee-text text-red-300/70 whitespace-nowrap">{error}</span>
            </div>
          </div>
        </>
      )}

      {lastUpdate && status === "connected" && (
        <>
          <span className="text-white/20 flex-shrink-0 hidden md:inline">·</span>
          <span className="text-white/30 flex-shrink-0 hidden md:inline">{lastUpdate.toLocaleTimeString()}</span>
        </>
      )}
    </div>
  );
}
