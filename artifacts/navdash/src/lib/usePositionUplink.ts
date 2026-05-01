import { useEffect, useRef, useState } from "react";
import { NavigationData } from "./signalk";

export interface UplinkConfig {
  enabled: boolean;
  baseUrl: string;
  vesselId: string;
  token: string;
  intervalSeconds: number;
}

export interface UplinkStatus {
  lastAttempt: Date | null;
  lastSuccess: Date | null;
  lastError: string | null;
  successCount: number;
  errorCount: number;
}

const STORAGE_KEY = "navdash_uplink_config";

export const DEFAULT_UPLINK_CONFIG: UplinkConfig = {
  enabled: false,
  baseUrl: "",
  vesselId: "phat-chance",
  token: "",
  intervalSeconds: 60,
};

export function loadUplinkConfig(): UplinkConfig {
  if (typeof window === "undefined") return DEFAULT_UPLINK_CONFIG;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_UPLINK_CONFIG;
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_UPLINK_CONFIG, ...parsed };
  } catch {
    return DEFAULT_UPLINK_CONFIG;
  }
}

export function saveUplinkConfig(cfg: UplinkConfig) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg));
}

export function usePositionUplink(config: UplinkConfig, nav: NavigationData) {
  const [stats, setStats] = useState<UplinkStatus>({
    lastAttempt: null,
    lastSuccess: null,
    lastError: null,
    successCount: 0,
    errorCount: 0,
  });

  const navRef = useRef(nav);
  navRef.current = nav;
  const inFlight = useRef(false);
  const consecutiveErrors = useRef(0);
  const nextAllowedAt = useRef(0);

  useEffect(() => {
    if (!config.enabled) return;
    if (!config.baseUrl || !config.vesselId || !config.token) return;
    const intervalMs = Math.max(10, config.intervalSeconds) * 1000;

    async function send() {
      if (inFlight.current) return;
      // Honour exponential backoff after consecutive failures.
      if (Date.now() < nextAllowedAt.current) return;
      const n = navRef.current;
      if (!n.position) return;
      inFlight.current = true;
      const attempt = new Date();
      setStats((s) => ({ ...s, lastAttempt: attempt }));
      try {
        const url = `${config.baseUrl.replace(/\/$/, "")}/api/track/${encodeURIComponent(config.vesselId)}`;
        const body = {
          latitude: n.position.latitude,
          longitude: n.position.longitude,
          speedOverGround: n.speedOverGround ?? null,
          courseOverGround: n.courseOverGroundTrue ?? null,
          headingTrue: n.headingTrue ?? null,
          headingMagnetic: n.headingMagnetic ?? null,
          depth: n.depthBelowKeel ?? n.depthBelowSurface ?? null,
          waterTemperature: n.waterTemperature ?? null,
          windSpeedTrue: n.windSpeedTrue ?? null,
          windAngleTrue: n.windAngleTrue ?? null,
          windSpeedApparent: n.windSpeedApparent ?? null,
          windAngleApparent: n.windAngleApparent ?? null,
        };
        const res = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${config.token}`,
          },
          body: JSON.stringify(body),
        });
        if (!res.ok) {
          const text = await res.text().catch(() => "");
          throw new Error(`HTTP ${res.status}: ${text.slice(0, 200)}`);
        }
        consecutiveErrors.current = 0;
        nextAllowedAt.current = 0;
        setStats((s) => ({
          ...s,
          lastSuccess: new Date(),
          successCount: s.successCount + 1,
          lastError: null,
        }));
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        consecutiveErrors.current += 1;
        // Exponential backoff: 1x, 2x, 4x, 8x interval, capped at ~30 minutes.
        const backoffMs = Math.min(
          intervalMs * 2 ** Math.min(consecutiveErrors.current - 1, 6),
          30 * 60 * 1000,
        );
        nextAllowedAt.current = Date.now() + backoffMs;
        setStats((s) => ({
          ...s,
          lastError: msg,
          errorCount: s.errorCount + 1,
        }));
      } finally {
        inFlight.current = false;
      }
    }

    // Reset backoff state when config changes.
    consecutiveErrors.current = 0;
    nextAllowedAt.current = 0;

    // Send immediately, then on interval.
    void send();
    const id = setInterval(send, intervalMs);
    return () => clearInterval(id);
  }, [config.enabled, config.baseUrl, config.vesselId, config.token, config.intervalSeconds]);

  return stats;
}
