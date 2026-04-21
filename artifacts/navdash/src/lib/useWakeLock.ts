import { useEffect, useState, useCallback } from "react";

const STORAGE_KEY = "navdash_keep_screen_on";

type WakeLockSentinelLike = {
  released: boolean;
  release: () => Promise<void>;
  addEventListener: (type: "release", cb: () => void) => void;
};

function isSupported(): boolean {
  return typeof navigator !== "undefined" && "wakeLock" in navigator;
}

export function useWakeLock() {
  const [enabled, setEnabled] = useState<boolean>(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) === "1";
    } catch {
      return false;
    }
  });
  const [active, setActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const supported = isSupported();

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, enabled ? "1" : "0");
    } catch {}
  }, [enabled]);

  useEffect(() => {
    if (!enabled || !supported) {
      setActive(false);
      return;
    }

    let sentinel: WakeLockSentinelLike | null = null;
    let cancelled = false;

    const acquire = async () => {
      try {
        const nav = navigator as Navigator & {
          wakeLock: { request: (type: "screen") => Promise<WakeLockSentinelLike> };
        };
        const s = await nav.wakeLock.request("screen");
        if (cancelled) {
          await s.release().catch(() => {});
          return;
        }
        sentinel = s;
        setActive(true);
        setError(null);
        s.addEventListener("release", () => {
          setActive(false);
        });
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        setError(msg);
        setActive(false);
      }
    };

    const onVisibility = () => {
      if (document.visibilityState === "visible" && enabled && (!sentinel || sentinel.released)) {
        acquire();
      }
    };

    acquire();
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisibility);
      if (sentinel && !sentinel.released) {
        sentinel.release().catch(() => {});
      }
      setActive(false);
    };
  }, [enabled, supported]);

  const toggle = useCallback(() => setEnabled((v) => !v), []);

  return { enabled, active, supported, error, setEnabled, toggle };
}
