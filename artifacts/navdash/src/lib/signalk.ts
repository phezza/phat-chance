import { useEffect, useRef, useState, useCallback } from "react";

export interface SignalKConfig {
  host: string;
  port: number;
  useTLS: boolean;
  self?: string;
}

export interface SignalKValue {
  value: unknown;
  timestamp: string;
  $source: string;
}

export interface SignalKDelta {
  context?: string;
  updates?: Array<{
    source?: { label?: string; type?: string; talker?: string };
    timestamp?: string;
    values?: Array<{ path: string; value: unknown }>;
  }>;
}

export type SignalKState = Record<string, SignalKValue>;

export interface AISTarget {
  mmsi: string;
  name?: string;
  callsign?: string;
  position?: { latitude: number; longitude: number };
  sog?: number;
  cog?: number;
  heading?: number;
  shipType?: number;
  length?: number;
  beam?: number;
  status?: number;
  timestamp?: string;
}

export interface NavigationData {
  speedOverGround?: number;
  courseOverGroundTrue?: number;
  courseOverGroundMagnetic?: number;
  headingTrue?: number;
  headingMagnetic?: number;
  speedThroughWater?: number;
  position?: { latitude: number; longitude: number };
  depthBelowKeel?: number;
  depthBelowSurface?: number;
  windSpeedApparent?: number;
  windAngleApparent?: number;
  windSpeedTrue?: number;
  windAngleTrue?: number;
  autopilotState?: string;
  autopilotTargetHeading?: number;
  waterTemperature?: number;
  magneticVariation?: number;
  logTrip?: number;
  logTotal?: number;
}

export type ConnectionStatus = "disconnected" | "connecting" | "connected" | "error";

const DEFAULT_CONFIG: SignalKConfig = {
  host: "192.168.1.1",
  port: 3000,
  useTLS: false,
};

const CONFIG_KEY = "navdash_signalk_config";

export function loadConfig(): SignalKConfig {
  try {
    const stored = localStorage.getItem(CONFIG_KEY);
    if (stored) return { ...DEFAULT_CONFIG, ...JSON.parse(stored) };
  } catch {}
  return { ...DEFAULT_CONFIG };
}

export function saveConfig(config: SignalKConfig): void {
  localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
}

function parsePath(path: string, value: unknown, nav: NavigationData): NavigationData {
  const result = { ...nav };
  switch (path) {
    case "navigation.speedOverGround":
      result.speedOverGround = typeof value === "number" ? value : undefined;
      break;
    case "navigation.courseOverGroundTrue":
      result.courseOverGroundTrue = typeof value === "number" ? value : undefined;
      break;
    case "navigation.courseOverGroundMagnetic":
      result.courseOverGroundMagnetic = typeof value === "number" ? value : undefined;
      break;
    case "navigation.headingTrue":
      result.headingTrue = typeof value === "number" ? value : undefined;
      break;
    case "navigation.headingMagnetic":
      result.headingMagnetic = typeof value === "number" ? value : undefined;
      break;
    case "navigation.speedThroughWater":
      result.speedThroughWater = typeof value === "number" ? value : undefined;
      break;
    case "navigation.position":
      if (value && typeof value === "object") {
        const pos = value as { latitude?: number; longitude?: number };
        if (pos.latitude != null && pos.longitude != null) {
          result.position = { latitude: pos.latitude, longitude: pos.longitude };
        }
      }
      break;
    case "environment.depth.belowKeel":
      result.depthBelowKeel = typeof value === "number" ? value : undefined;
      break;
    case "environment.depth.belowSurface":
      result.depthBelowSurface = typeof value === "number" ? value : undefined;
      break;
    case "environment.wind.speedApparent":
      result.windSpeedApparent = typeof value === "number" ? value : undefined;
      break;
    case "environment.wind.angleApparent":
      result.windAngleApparent = typeof value === "number" ? value : undefined;
      break;
    case "environment.wind.speedTrue":
      result.windSpeedTrue = typeof value === "number" ? value : undefined;
      break;
    case "environment.wind.angleTrueWater":
    case "environment.wind.angleTrueGround":
      result.windAngleTrue = typeof value === "number" ? value : undefined;
      break;
    case "steering.autopilot.state":
      result.autopilotState = typeof value === "string" ? value : undefined;
      break;
    case "steering.autopilot.target.headingMagnetic":
    case "steering.autopilot.target.headingTrue":
      result.autopilotTargetHeading = typeof value === "number" ? value : undefined;
      break;
    case "environment.water.temperature":
      result.waterTemperature = typeof value === "number" ? value : undefined;
      break;
    case "navigation.magneticVariation":
      result.magneticVariation = typeof value === "number" ? value : undefined;
      break;
    case "navigation.trip.log":
      result.logTrip = typeof value === "number" ? value : undefined;
      break;
    case "navigation.log":
      result.logTotal = typeof value === "number" ? value : undefined;
      break;
  }
  return result;
}

function parseAISPath(
  path: string,
  value: unknown,
  mmsi: string,
  targets: Map<string, AISTarget>
): Map<string, AISTarget> {
  const next = new Map(targets);
  const existing = next.get(mmsi) ?? { mmsi };

  const updated = { ...existing };

  if (path === "name") updated.name = typeof value === "string" ? value : undefined;
  else if (path === "communication.callsignVhf") updated.callsign = typeof value === "string" ? value : undefined;
  else if (path === "navigation.position" && value && typeof value === "object") {
    const pos = value as { latitude?: number; longitude?: number };
    if (pos.latitude != null && pos.longitude != null)
      updated.position = { latitude: pos.latitude, longitude: pos.longitude };
  } else if (path === "navigation.speedOverGround") updated.sog = typeof value === "number" ? value : undefined;
  else if (path === "navigation.courseOverGroundTrue") updated.cog = typeof value === "number" ? value : undefined;
  else if (path === "navigation.headingTrue") updated.heading = typeof value === "number" ? value : undefined;
  else if (path === "design.aisShipType" && value && typeof value === "object") {
    const st = value as { id?: number };
    updated.shipType = st.id;
  } else if (path === "design.length" && value && typeof value === "object") {
    const l = value as { overall?: number };
    updated.length = l.overall;
  } else if (path === "design.beam") updated.beam = typeof value === "number" ? value : undefined;
  else if (path === "navigation.state") updated.status = typeof value === "number" ? value : undefined;

  updated.timestamp = new Date().toISOString();
  next.set(mmsi, updated);
  return next;
}

export function useSignalK() {
  const [config, setConfigState] = useState<SignalKConfig>(loadConfig);
  const [status, setStatus] = useState<ConnectionStatus>("disconnected");
  const [nav, setNav] = useState<NavigationData>({});
  const [aisTargets, setAISTargets] = useState<Map<string, AISTarget>>(new Map());
  const [rawState, setRawState] = useState<SignalKState>({});
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);

  const updateConfig = useCallback((newConfig: SignalKConfig) => {
    saveConfig(newConfig);
    setConfigState(newConfig);
  }, []);

  const connect = useCallback((cfg: SignalKConfig) => {
    if (wsRef.current) {
      wsRef.current.onclose = null;
      wsRef.current.close();
      wsRef.current = null;
    }
    if (reconnectRef.current) {
      clearTimeout(reconnectRef.current);
      reconnectRef.current = null;
    }

    setStatus("connecting");
    setError(null);

    const protocol = cfg.useTLS ? "wss" : "ws";
    const url = `${protocol}://${cfg.host}:${cfg.port}/signalk/v1/stream?subscribe=all`;

    try {
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        if (!mountedRef.current) return;
        setStatus("connected");
        setError(null);
      };

      ws.onmessage = (event) => {
        if (!mountedRef.current) return;
        try {
          const data: SignalKDelta = JSON.parse(event.data);
          setLastUpdate(new Date());

          if (!data.updates) return;

          const context = data.context ?? "vessels.self";
          const isSelf = context === "vessels.self" || context.includes("self");

          const mmsiMatch = context.match(/vessels\.urn:mrn:imo:mmsi:(\d+)/);
          const mmsi = mmsiMatch?.[1];

          for (const update of data.updates) {
            if (!update.values) continue;
            for (const { path, value } of update.values) {
              setRawState((prev) => ({
                ...prev,
                [`${context}.${path}`]: {
                  value,
                  timestamp: update.timestamp ?? new Date().toISOString(),
                  $source: update.source?.label ?? "",
                },
              }));

              if (isSelf) {
                setNav((prev) => parsePath(path, value, prev));
              } else if (mmsi) {
                setAISTargets((prev) => parseAISPath(path, value, mmsi, prev));
              }
            }
          }
        } catch {
        }
      };

      ws.onerror = () => {
        if (!mountedRef.current) return;
        setStatus("error");
        setError(`Cannot connect to Signal K at ${cfg.host}:${cfg.port}`);
      };

      ws.onclose = () => {
        if (!mountedRef.current) return;
        setStatus("disconnected");
        reconnectRef.current = setTimeout(() => {
          if (mountedRef.current) connect(cfg);
        }, 5000);
      };
    } catch (e) {
      setStatus("error");
      setError(String(e));
    }
  }, []);

  const disconnect = useCallback(() => {
    if (reconnectRef.current) {
      clearTimeout(reconnectRef.current);
      reconnectRef.current = null;
    }
    if (wsRef.current) {
      wsRef.current.onclose = null;
      wsRef.current.close();
      wsRef.current = null;
    }
    setStatus("disconnected");
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    connect(config);
    return () => {
      mountedRef.current = false;
      disconnect();
    };
  }, []);

  return {
    config,
    updateConfig,
    status,
    nav,
    aisTargets,
    rawState,
    lastUpdate,
    error,
    connect,
    disconnect,
  };
}

export function radToDeg(rad: number): number {
  return (rad * 180) / Math.PI;
}

export function mpsToKnots(mps: number): number {
  return mps * 1.94384;
}

export function metersToFeet(m: number): number {
  return m * 3.28084;
}

export function metersToNM(m: number): number {
  return m / 1852;
}

export function celsiusToFahrenheit(c: number): number {
  return c * 1.8 + 32;
}

export function formatDeg(deg: number): string {
  const d = ((deg % 360) + 360) % 360;
  return `${d.toFixed(1)}°`;
}

export function formatLatLon(lat: number, lon: number): string {
  const latDir = lat >= 0 ? "N" : "S";
  const lonDir = lon >= 0 ? "E" : "W";
  const latDeg = Math.floor(Math.abs(lat));
  const latMin = (Math.abs(lat) - latDeg) * 60;
  const lonDeg = Math.floor(Math.abs(lon));
  const lonMin = (Math.abs(lon) - lonDeg) * 60;
  return `${latDeg}°${latMin.toFixed(3)}'${latDir}  ${lonDeg}°${lonMin.toFixed(3)}'${lonDir}`;
}

export function getAISShipTypeName(type?: number): string {
  if (type == null) return "Unknown";
  if (type >= 20 && type < 30) return "Wing in Ground";
  if (type >= 30 && type < 40) {
    const map: Record<number, string> = {
      30: "Fishing",
      31: "Towing",
      32: "Towing Large",
      33: "Dredge",
      34: "Dive Ops",
      35: "Military",
      36: "Sailing",
      37: "Pleasure Craft",
    };
    return map[type] ?? "Fishing/Special";
  }
  if (type >= 40 && type < 50) return "High Speed Craft";
  if (type === 50) return "Pilot Vessel";
  if (type === 51) return "SAR";
  if (type === 52) return "Tug";
  if (type === 53) return "Port Tender";
  if (type === 55) return "Law Enforcement";
  if (type === 58) return "Medical";
  if (type >= 60 && type < 70) return "Passenger";
  if (type >= 70 && type < 80) return "Cargo";
  if (type >= 80 && type < 90) return "Tanker";
  return "Other";
}

export function getNavStatus(status?: number): string {
  const map: Record<number, string> = {
    0: "Under way",
    1: "At anchor",
    2: "Not under command",
    3: "Restricted maneuverability",
    4: "Constrained by draft",
    5: "Moored",
    6: "Aground",
    7: "Engaged in fishing",
    8: "Under sail",
    15: "Default",
  };
  return status != null ? (map[status] ?? `Status ${status}`) : "Unknown";
}
