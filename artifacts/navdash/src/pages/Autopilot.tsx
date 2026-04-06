import { useState, useCallback, useRef, useEffect } from "react";
import { useSK } from "@/lib/SignalKContext";
import { radToDeg } from "@/lib/signalk";
import { cn } from "@/lib/utils";
import {
  Cpu,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Wind,
  Navigation2,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Route,
} from "lucide-react";

function computeChecksum(body: string): string {
  let cs = 0;
  for (let i = 0; i < body.length; i++) cs ^= body.charCodeAt(i);
  return cs.toString(16).toUpperCase().padStart(2, "0");
}

function buildNMEA(body: string): string {
  return `$${body}*${computeChecksum(body)}`;
}

function buildAPBSentence(headingDeg: number): string {
  const hdg = headingDeg.toFixed(1);
  const body = `IIAPB,A,A,0.00,L,N,V,V,${hdg},T,HELM,${hdg},T,${hdg},T`;
  return buildNMEA(body);
}

function buildHDTSentence(headingDeg: number): string {
  const body = `IIHDT,${headingDeg.toFixed(1)},T`;
  return buildNMEA(body);
}

function normDeg(d: number): number {
  return ((d % 360) + 360) % 360;
}

type APMode = "standby" | "auto" | "wind" | "track";
type CmdStatus = "idle" | "sending" | "ok" | "error";

interface CommandEntry {
  time: string;
  sentence: string;
  ok: boolean;
}

function HeadingRing({
  current,
  target,
}: {
  current: number | undefined;
  target: number;
}) {
  const size = 220;
  const cx = size / 2;
  const cy = size / 2;
  const r = 90;
  const inner = 70;

  function pointOnCircle(angle: number, radius: number) {
    const rad = ((angle - 90) * Math.PI) / 180;
    return { x: cx + radius * Math.cos(rad), y: cy + radius * Math.sin(rad) };
  }

  const tickMarks = Array.from({ length: 72 }, (_, i) => {
    const deg = i * 5;
    const major = deg % 30 === 0;
    const med = deg % 10 === 0;
    const outerR = r;
    const innerR = major ? r - 14 : med ? r - 9 : r - 5;
    const p1 = pointOnCircle(deg, outerR);
    const p2 = pointOnCircle(deg, innerR);
    return { p1, p2, major, med, deg };
  });

  const cardinals = ["N", "E", "S", "W"];

  const hdgRad = (((current ?? 0) - 90) * Math.PI) / 180;
  const tgtRad = ((target - 90) * Math.PI) / 180;

  const needleLen = inner - 12;
  const needleTip = { x: cx + needleLen * Math.cos(hdgRad), y: cy + needleLen * Math.sin(hdgRad) };
  const needleBase = { x: cx - 18 * Math.cos(hdgRad), y: cy - 18 * Math.sin(hdgRad) };
  const needleLeft = { x: cx + 7 * Math.cos(hdgRad + Math.PI / 2), y: cy + 7 * Math.sin(hdgRad + Math.PI / 2) };
  const needleRight = { x: cx - 7 * Math.cos(hdgRad + Math.PI / 2), y: cy - 7 * Math.sin(hdgRad + Math.PI / 2) };

  const tgtTip = { x: cx + (r - 4) * Math.cos(tgtRad), y: cy + (r - 4) * Math.sin(tgtRad) };
  const tgtBase = { x: cx + (r - 18) * Math.cos(tgtRad), y: cy + (r - 18) * Math.sin(tgtRad) };
  const tgtL = { x: cx + 5 * Math.cos(tgtRad + Math.PI / 2) + (r - 11) * Math.cos(tgtRad), y: cy + 5 * Math.sin(tgtRad + Math.PI / 2) + (r - 11) * Math.sin(tgtRad) };
  const tgtR = { x: cx - 5 * Math.cos(tgtRad + Math.PI / 2) + (r - 11) * Math.cos(tgtRad), y: cy - 5 * Math.sin(tgtRad + Math.PI / 2) + (r - 11) * Math.sin(tgtRad) };

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={1} />
      <circle cx={cx} cy={cy} r={inner} fill="rgba(0,0,0,0.4)" stroke="rgba(255,255,255,0.08)" strokeWidth={1} />

      {tickMarks.map(({ p1, p2, major, deg }) => (
        <line
          key={deg}
          x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y}
          stroke={major ? "rgba(255,255,255,0.5)" : "rgba(255,255,255,0.2)"}
          strokeWidth={major ? 1.5 : 0.8}
        />
      ))}

      {cardinals.map((c, i) => {
        const p = pointOnCircle(i * 90, r - 24);
        return (
          <text key={c} x={p.x} y={p.y} textAnchor="middle" dominantBaseline="central"
            fill={c === "N" ? "#f87171" : "rgba(255,255,255,0.6)"}
            fontSize={c === "N" ? "11" : "9"} fontWeight={c === "N" ? "bold" : "normal"}
            fontFamily="monospace"
          >{c}</text>
        );
      })}

      {/* Target heading marker */}
      <polygon
        points={`${tgtTip.x},${tgtTip.y} ${tgtL.x},${tgtL.y} ${tgtBase.x},${tgtBase.y} ${tgtR.x},${tgtR.y}`}
        fill="#f59e0b" fillOpacity={0.85}
      />

      {/* Current heading needle */}
      {current !== undefined && (
        <polygon
          points={`${needleTip.x},${needleTip.y} ${needleLeft.x},${needleLeft.y} ${needleBase.x},${needleBase.y} ${needleRight.x},${needleRight.y}`}
          fill="#06b6d4" fillOpacity={0.9}
        />
      )}

      <circle cx={cx} cy={cy} r={5} fill="rgba(255,255,255,0.2)" stroke="rgba(255,255,255,0.4)" strokeWidth={1} />

      <text x={cx} y={cy - 10} textAnchor="middle" dominantBaseline="central"
        fill={current !== undefined ? "#e2e8f0" : "rgba(255,255,255,0.3)"}
        fontSize="18" fontWeight="bold" fontFamily="monospace"
      >
        {current !== undefined ? `${normDeg(current).toFixed(0)}°` : "---"}
      </text>
      <text x={cx} y={cy + 12} textAnchor="middle" dominantBaseline="central"
        fill="rgba(255,255,255,0.4)" fontSize="8" fontFamily="monospace"
      >HDG TRUE</text>
    </svg>
  );
}

const MODES: { id: APMode; label: string; icon: React.ReactNode; desc: string }[] = [
  { id: "standby", label: "Standby", icon: null, desc: "Disengage autopilot" },
  { id: "auto", label: "Auto", icon: <Navigation2 className="w-3 h-3" />, desc: "Hold set heading" },
  { id: "wind", label: "Wind", icon: <Wind className="w-3 h-3" />, desc: "Follow wind angle" },
  { id: "track", label: "Track", icon: <Route className="w-3 h-3" />, desc: "Follow GPS route" },
];

export function Autopilot() {
  const { nav, config, putSK, sendNMEA, status } = useSK();

  const rawHdg = nav.headingTrue ?? nav.headingMagnetic;
  const currentHdgDeg = rawHdg !== undefined ? normDeg(radToDeg(rawHdg)) : undefined;

  const rawAPHdg = nav.autopilotTargetHeading;
  const skAPState = nav.autopilotState as APMode | undefined;

  const [commandHdg, setCommandHdg] = useState<number>(() =>
    rawAPHdg !== undefined ? normDeg(radToDeg(rawAPHdg)) : currentHdgDeg ?? 0
  );
  const [inputVal, setInputVal] = useState<string>("");
  const [cmdStatus, setCmdStatus] = useState<CmdStatus>("idle");
  const [cmdLog, setCmdLog] = useState<CommandEntry[]>([]);
  const [activeMode, setActiveMode] = useState<APMode>(skAPState ?? "standby");

  useEffect(() => {
    if (skAPState) setActiveMode(skAPState as APMode);
  }, [skAPState]);

  useEffect(() => {
    if (rawAPHdg !== undefined) {
      setCommandHdg(normDeg(radToDeg(rawAPHdg)));
    }
  }, [rawAPHdg]);

  const connected = status === "connected";
  const isNMEA = config.mode === "nmea-tcp";

  function logCmd(sentence: string, ok: boolean) {
    const time = new Date().toLocaleTimeString("en-GB", { hour12: false });
    setCmdLog((prev) => [{ time, sentence, ok }, ...prev].slice(0, 20));
  }

  const sendHeading = useCallback(async (hdg: number) => {
    const normHdg = normDeg(hdg);
    setCmdStatus("sending");
    try {
      if (isNMEA) {
        const apb = buildAPBSentence(normHdg);
        const hdt = buildHDTSentence(normHdg);
        sendNMEA(apb);
        sendNMEA(hdt);
        logCmd(apb, true);
        logCmd(hdt, true);
        setCmdStatus("ok");
      } else {
        const rad = (normHdg * Math.PI) / 180;
        await putSK("steering/autopilot/target/headingTrue", rad);
        logCmd(`PUT steering/autopilot/target/headingTrue = ${rad.toFixed(4)} rad (${normHdg.toFixed(1)}°)`, true);
        setCmdStatus("ok");
      }
    } catch (e) {
      logCmd(`ERROR: ${String(e)}`, false);
      setCmdStatus("error");
    }
    setTimeout(() => setCmdStatus("idle"), 2500);
  }, [isNMEA, putSK, sendNMEA]);

  const sendMode = useCallback(async (mode: APMode) => {
    setCmdStatus("sending");
    try {
      if (isNMEA) {
        const body = `IIAPB,A,A,0.00,L,N,V,V,${commandHdg.toFixed(1)},T,HELM,${commandHdg.toFixed(1)},T,${commandHdg.toFixed(1)},T`;
        const sentence = buildNMEA(body);
        sendNMEA(sentence);
        logCmd(`[MODE:${mode}] ${sentence}`, true);
        setActiveMode(mode);
        setCmdStatus("ok");
      } else {
        await putSK("steering/autopilot/state", mode);
        logCmd(`PUT steering/autopilot/state = "${mode}"`, true);
        setActiveMode(mode);
        setCmdStatus("ok");
      }
    } catch (e) {
      logCmd(`ERROR: ${String(e)}`, false);
      setCmdStatus("error");
    }
    setTimeout(() => setCmdStatus("idle"), 2500);
  }, [isNMEA, putSK, sendNMEA, commandHdg]);

  function adjustHeading(delta: number) {
    const next = normDeg(commandHdg + delta);
    setCommandHdg(next);
    sendHeading(next);
  }

  function handleSetHeading() {
    const v = parseFloat(inputVal);
    if (!isNaN(v)) {
      const clamped = normDeg(v);
      setCommandHdg(clamped);
      setInputVal("");
      sendHeading(clamped);
    }
  }

  const statusColors: Record<APMode, string> = {
    standby: "text-white/50 bg-white/5 border-white/10",
    auto: "text-cyan-400 bg-cyan-500/15 border-cyan-500/25",
    wind: "text-green-400 bg-green-500/15 border-green-500/25",
    track: "text-purple-400 bg-purple-500/15 border-purple-500/25",
  };

  const modeColor = statusColors[activeMode];

  return (
    <div className="flex flex-col h-full bg-[#070d1a] overflow-y-auto">
      <div className="flex-shrink-0 px-4 pt-4 pb-3 flex flex-wrap items-center justify-between gap-3 border-b border-white/8">
        <div className="flex items-center gap-3">
          <Cpu className="w-5 h-5 text-cyan-400" />
          <h1 className="text-white font-semibold tracking-wide">Autopilot</h1>
          <span className={cn("px-2.5 py-0.5 rounded-full text-xs font-mono font-medium border uppercase tracking-wider", modeColor)}>
            {activeMode}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {cmdStatus === "sending" && <Loader2 className="w-4 h-4 text-cyan-400 animate-spin" />}
          {cmdStatus === "ok" && <CheckCircle2 className="w-4 h-4 text-green-400" />}
          {cmdStatus === "error" && <AlertTriangle className="w-4 h-4 text-red-400" />}
          <span className={cn("text-xs font-mono", connected ? "text-green-400" : "text-white/30")}>
            {connected ? "CONNECTED" : "NO SIGNAL"}
          </span>
          {isNMEA && (
            <span className="text-xs font-mono text-amber-400/60 border border-amber-400/20 rounded px-1.5 py-0.5">
              NMEA MODE
            </span>
          )}
        </div>
      </div>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-4 p-4">

        <div className="flex flex-col items-center gap-4 bg-white/3 border border-white/8 rounded-2xl p-5">
          <p className="text-xs font-mono text-white/40 uppercase tracking-widest">Current Heading</p>
          <HeadingRing current={currentHdgDeg} target={commandHdg} />
          <div className="flex gap-6 text-center">
            <div>
              <div className="text-xs text-white/40 font-mono uppercase tracking-wider">Heading</div>
              <div className="text-xl font-mono font-bold text-cyan-400">
                {currentHdgDeg !== undefined ? `${currentHdgDeg.toFixed(0)}°` : "---"}
              </div>
            </div>
            <div className="w-px bg-white/10" />
            <div>
              <div className="text-xs text-amber-400/60 font-mono uppercase tracking-wider">Target</div>
              <div className="text-xl font-mono font-bold text-amber-400">
                {commandHdg.toFixed(0)}°
              </div>
            </div>
          </div>
          <p className="text-xs text-white/20 font-mono text-center">
            Cyan needle = current · Amber = commanded
          </p>
        </div>

        <div className="flex flex-col gap-4">
          <div className="bg-white/3 border border-white/8 rounded-2xl p-4">
            <p className="text-xs font-mono text-white/40 uppercase tracking-widest mb-3">Mode</p>
            <div className="grid grid-cols-2 gap-2">
              {MODES.map((m) => (
                <button
                  key={m.id}
                  onClick={() => sendMode(m.id)}
                  disabled={!connected}
                  title={m.desc}
                  className={cn(
                    "flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-sm font-mono font-medium transition-all border",
                    activeMode === m.id
                      ? m.id === "standby"
                        ? "bg-white/10 text-white border-white/20"
                        : "bg-cyan-500/20 text-cyan-400 border-cyan-500/30"
                      : "bg-white/3 text-white/40 border-white/8 hover:bg-white/8 hover:text-white/70",
                    !connected && "opacity-40 cursor-not-allowed"
                  )}
                >
                  {m.icon}
                  {m.label}
                </button>
              ))}
            </div>
            {isNMEA && (
              <p className="text-xs text-amber-400/50 font-mono mt-2">
                Mode engage/standby may require Signal K mode for full autopilot control.
              </p>
            )}
          </div>

          <div className="bg-white/3 border border-white/8 rounded-2xl p-4">
            <p className="text-xs font-mono text-white/40 uppercase tracking-widest mb-3">Heading Adjust</p>
            <div className="flex items-center justify-center gap-1">
              <AdjBtn onClick={() => adjustHeading(-10)} disabled={!connected} icon={<ChevronsLeft className="w-4 h-4" />} label="−10°" port />
              <AdjBtn onClick={() => adjustHeading(-1)} disabled={!connected} icon={<ChevronLeft className="w-4 h-4" />} label="−1°" port />
              <div className="flex-1 text-center px-2">
                <div className="text-2xl font-mono font-bold text-amber-400">{commandHdg.toFixed(0)}°</div>
                <div className="text-xs text-white/30 font-mono">COMMANDED</div>
              </div>
              <AdjBtn onClick={() => adjustHeading(1)} disabled={!connected} icon={<ChevronRight className="w-4 h-4" />} label="+1°" />
              <AdjBtn onClick={() => adjustHeading(10)} disabled={!connected} icon={<ChevronsRight className="w-4 h-4" />} label="+10°" />
            </div>
            <div className="mt-3 flex gap-2">
              <input
                type="number"
                min={0}
                max={359}
                step={1}
                value={inputVal}
                onChange={(e) => setInputVal(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSetHeading()}
                placeholder="Enter heading 0–359°"
                disabled={!connected}
                className="flex-1 bg-black/30 border border-white/12 rounded-lg px-3 py-2 text-sm font-mono text-white placeholder:text-white/20 focus:outline-none focus:border-cyan-500/50 disabled:opacity-40"
              />
              <button
                onClick={handleSetHeading}
                disabled={!connected || inputVal === ""}
                className={cn(
                  "px-4 py-2 rounded-lg text-sm font-mono font-medium transition-all border",
                  connected && inputVal !== ""
                    ? "bg-cyan-500/20 text-cyan-400 border-cyan-500/30 hover:bg-cyan-500/30"
                    : "bg-white/5 text-white/20 border-white/8 cursor-not-allowed"
                )}
              >
                Set
              </button>
            </div>
          </div>
        </div>

        <div className="bg-white/3 border border-white/8 rounded-2xl p-4 flex flex-col">
          <p className="text-xs font-mono text-white/40 uppercase tracking-widest mb-3">Command Log</p>
          {!connected && (
            <div className="flex-1 flex flex-col items-center justify-center gap-2 text-white/30">
              <AlertTriangle className="w-8 h-8" />
              <p className="text-sm font-mono text-center">Not connected<br />Go to Settings to connect</p>
            </div>
          )}
          {connected && cmdLog.length === 0 && (
            <p className="text-xs font-mono text-white/20 italic">No commands sent yet</p>
          )}
          <div className="flex-1 overflow-y-auto space-y-1.5 font-mono text-xs">
            {cmdLog.map((entry, i) => (
              <div key={i} className={cn("rounded-lg px-2.5 py-2 border", entry.ok ? "bg-green-500/5 border-green-500/15 text-green-400/70" : "bg-red-500/5 border-red-500/15 text-red-400/70")}>
                <span className="text-white/30">{entry.time} </span>
                <span className="break-all">{entry.sentence}</span>
              </div>
            ))}
          </div>
          {isNMEA && (
            <div className="mt-3 pt-3 border-t border-white/8">
              <p className="text-xs font-mono text-white/30">
                Sends APB + HDT sentences via NavLink2 TCP stream.
                Autopilot must be in NAV/Track mode to respond.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function AdjBtn({
  onClick,
  disabled,
  icon,
  label,
  port,
}: {
  onClick: () => void;
  disabled: boolean;
  icon: React.ReactNode;
  label: string;
  port?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={label}
      className={cn(
        "flex flex-col items-center justify-center gap-0.5 w-12 h-14 rounded-xl border transition-all text-xs font-mono",
        port
          ? "bg-red-500/10 text-red-400 border-red-500/20 hover:bg-red-500/20 active:scale-95"
          : "bg-green-500/10 text-green-400 border-green-500/20 hover:bg-green-500/20 active:scale-95",
        disabled && "opacity-30 cursor-not-allowed"
      )}
    >
      {icon}
      <span className="text-[9px]">{label}</span>
    </button>
  );
}
