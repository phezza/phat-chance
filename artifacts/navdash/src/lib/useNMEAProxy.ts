import { useEffect, useRef, useState, useCallback } from "react";
import { NavigationData, AISTarget, ConnectionStatus, SignalKConfig } from "./signalk";
import { parseNMEASentence, nmeaChecksum } from "./nmea";

interface NMEAProxyMsg {
  type: "connected" | "disconnected" | "connecting" | "error" | "nmea" | "sent";
  message?: string;
  sentence?: string;
}

export interface ParseStats {
  total: number;
  recognised: number;
  withData: number;
  badChecksum: number;
  byType: Record<string, { count: number; parsed: number }>;
}

export interface NMEALogEntry {
  sentence: string;
  type: string;
  status: "data" | "parsed-empty" | "unknown" | "bad-checksum";
}

const KNOWN_SENTENCES = new Set([
  "RMC", "GGA", "GLL", "VTG", "HDG", "HDM", "HDT", "MWV", "MWD",
  "VHW", "DBT", "DBS", "DBK", "DPT", "MTW", "VLW", "VDM", "VDO",
  "RSA", "MDA", "VDR", "ZDA", "GSA", "GSV",
]);

export function useNMEAProxy(config: SignalKConfig) {
  const [status, setStatus] = useState<ConnectionStatus>("disconnected");
  const [nav, setNav] = useState<NavigationData>({});
  const [aisTargets, setAISTargets] = useState<Map<string, AISTarget>>(new Map());
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [nmeaLog, setNmeaLog] = useState<NMEALogEntry[]>([]);
  const [parseStats, setParseStats] = useState<ParseStats>({
    total: 0, recognised: 0, withData: 0, badChecksum: 0, byType: {},
  });

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);
  const configRef = useRef(config);
  configRef.current = config;

  const disconnect = useCallback(() => {
    if (reconnectRef.current) { clearTimeout(reconnectRef.current); reconnectRef.current = null; }
    if (wsRef.current) { wsRef.current.onclose = null; wsRef.current.close(); wsRef.current = null; }
    setStatus("disconnected");
  }, []);

  const connect = useCallback((cfg: SignalKConfig) => {
    if (wsRef.current) { wsRef.current.onclose = null; wsRef.current.close(); wsRef.current = null; }
    if (reconnectRef.current) { clearTimeout(reconnectRef.current); reconnectRef.current = null; }

    setStatus("connecting");
    setError(null);

    const wsProtocol = window.location.protocol === "https:" ? "wss" : "ws";
    const wsHost = window.location.host;
    const proxyUrl = `${wsProtocol}://${wsHost}/api/nmea-stream?host=${encodeURIComponent(cfg.nmeaHost)}&port=${cfg.nmeaPort}`;

    try {
      const ws = new WebSocket(proxyUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        if (!mountedRef.current) return;
        setStatus("connecting");
      };

      ws.onmessage = (event) => {
        if (!mountedRef.current) return;
        try {
          const msg: NMEAProxyMsg = JSON.parse(event.data);

          if (msg.type === "connected") {
            setStatus("connected");
            setError(null);
          } else if (msg.type === "disconnected") {
            setStatus("error");
            setError(msg.message ?? "TCP disconnected");
          } else if (msg.type === "connecting") {
            setStatus("connecting");
          } else if (msg.type === "error") {
            setStatus("error");
            setError(msg.message ?? "Connection error");
          } else if (msg.type === "nmea" && msg.sentence) {
            const sentence = msg.sentence;
            setLastUpdate(new Date());

            const tagMatch = sentence.match(/^[!$]([A-Z0-9]+)/);
            const tag = tagMatch?.[1] ?? "";
            const sentenceType = tag.length >= 5 ? tag.substring(tag.length - 3) : tag;
            const checksumOk = nmeaChecksum(sentence);
            const result = checksumOk ? parseNMEASentence(sentence) : null;

            const hasNav = !!(result?.nav && Object.keys(result.nav).length > 0);
            const hasAIS = !!result?.ais;
            const hasData = hasNav || hasAIS;
            const isKnown = KNOWN_SENTENCES.has(sentenceType);

            const entryStatus: NMEALogEntry["status"] = !checksumOk
              ? "bad-checksum"
              : hasData
              ? "data"
              : isKnown
              ? "parsed-empty"
              : "unknown";

            setNmeaLog((prev) =>
              [{ sentence, type: sentenceType, status: entryStatus }, ...prev].slice(0, 200)
            );

            setParseStats((prev) => {
              const byType = { ...prev.byType };
              const cur = byType[sentenceType] ?? { count: 0, parsed: 0 };
              byType[sentenceType] = {
                count: cur.count + 1,
                parsed: cur.parsed + (hasData ? 1 : 0),
              };
              return {
                total: prev.total + 1,
                recognised: prev.recognised + (isKnown ? 1 : 0),
                withData: prev.withData + (hasData ? 1 : 0),
                badChecksum: prev.badChecksum + (checksumOk ? 0 : 1),
                byType,
              };
            });

            if (!result) return;

            if (result.nav && Object.keys(result.nav).length > 0) {
              setNav((prev) => ({ ...prev, ...result.nav }));
            }

            if (result.ais) {
              const aisData = result.ais;
              setAISTargets((prev) => {
                const next = new Map(prev);
                const existing = next.get(aisData.mmsi) ?? { mmsi: aisData.mmsi };
                next.set(aisData.mmsi, {
                  ...existing,
                  ...Object.fromEntries(Object.entries(aisData).filter(([, v]) => v !== undefined)),
                  timestamp: new Date().toISOString(),
                });
                return next;
              });
            }
          }
        } catch {}
      };

      ws.onerror = () => {
        if (!mountedRef.current) return;
        setStatus("error");
        setError("Cannot connect to proxy server — check the app server is running");
      };

      ws.onclose = () => {
        if (!mountedRef.current) return;
        setStatus("disconnected");
        reconnectRef.current = setTimeout(() => {
          if (mountedRef.current) connect(configRef.current);
        }, 5000);
      };
    } catch (e) {
      setStatus("error");
      setError(String(e));
    }
  }, []);

  const sendSentence = useCallback((sentence: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "send", sentence }));
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    if (config.mode === "nmea-tcp") connect(config);
    return () => { mountedRef.current = false; disconnect(); };
  }, []);

  return { status, nav, setNav, aisTargets, setAISTargets, rawState: {}, setRawState: () => {}, lastUpdate, setLastUpdate, error, setError, setStatus, connect, disconnect, nmeaLog, sendSentence, parseStats };
}
