import { createContext, useContext, useState, useCallback, ReactNode } from "react";
import { useSignalK } from "./signalk";
import { useNMEAProxy, NMEALogEntry, ParseStats } from "./useNMEAProxy";
import { loadConfig, saveConfig, SignalKConfig, ConnectionStatus, NavigationData, AISTarget, SignalKState } from "./signalk";

export interface SKContextValue {
  config: SignalKConfig;
  updateConfig: (cfg: SignalKConfig) => void;
  status: ConnectionStatus;
  nav: NavigationData;
  aisTargets: Map<string, AISTarget>;
  rawState: SignalKState;
  lastUpdate: Date | null;
  error: string | null;
  connect: (cfg: SignalKConfig) => void;
  disconnect: () => void;
  nmeaLog?: NMEALogEntry[];
  parseStats?: ParseStats;
  putSK: (path: string, value: unknown) => Promise<void>;
  sendNMEA: (sentence: string) => void;
}

const SignalKContext = createContext<SKContextValue | null>(null);

function buildSKUrl(config: SignalKConfig, path: string): string {
  const scheme = config.useTLS ? "https" : "http";
  return `${scheme}://${config.host}:${config.port}/signalk/v1/api/vessels/self/${path}`;
}

function SignalKModeProvider({ config, updateConfig, children }: {
  config: SignalKConfig;
  updateConfig: (c: SignalKConfig) => void;
  children: ReactNode;
}) {
  const sk = useSignalK(config);

  const putSK = useCallback(async (path: string, value: unknown) => {
    const url = buildSKUrl(config, path);
    const resp = await fetch(url, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ value }),
    });
    if (!resp.ok) throw new Error(`Signal K PUT failed: ${resp.status} ${resp.statusText}`);
  }, [config]);

  return (
    <SignalKContext.Provider value={{
      config,
      updateConfig,
      connect: sk.connect,
      disconnect: sk.disconnect,
      status: sk.status,
      nav: sk.nav,
      aisTargets: sk.aisTargets,
      rawState: sk.rawState,
      lastUpdate: sk.lastUpdate,
      error: sk.error,
      putSK,
      sendNMEA: () => {},
    }}>
      {children}
    </SignalKContext.Provider>
  );
}

function NMEAModeProvider({ config, updateConfig, children }: {
  config: SignalKConfig;
  updateConfig: (c: SignalKConfig) => void;
  children: ReactNode;
}) {
  const proxy = useNMEAProxy(config);

  return (
    <SignalKContext.Provider value={{
      config,
      updateConfig,
      connect: proxy.connect,
      disconnect: proxy.disconnect,
      status: proxy.status,
      nav: proxy.nav,
      aisTargets: proxy.aisTargets,
      rawState: proxy.rawState,
      lastUpdate: proxy.lastUpdate,
      error: proxy.error,
      nmeaLog: proxy.nmeaLog,
      parseStats: proxy.parseStats,
      putSK: async () => { throw new Error("Signal K PUT not available in NMEA TCP mode"); },
      sendNMEA: proxy.sendSentence,
    }}>
      {children}
    </SignalKContext.Provider>
  );
}

export function SignalKProvider({ children }: { children: ReactNode }) {
  const [config, setConfigState] = useState<SignalKConfig>(loadConfig);

  const updateConfig = useCallback((cfg: SignalKConfig) => {
    saveConfig(cfg);
    setConfigState(cfg);
  }, []);

  if (config.mode === "nmea-tcp") {
    return (
      <NMEAModeProvider key="nmea" config={config} updateConfig={updateConfig}>
        {children}
      </NMEAModeProvider>
    );
  }
  return (
    <SignalKModeProvider key="signalk" config={config} updateConfig={updateConfig}>
      {children}
    </SignalKModeProvider>
  );
}

export function useSK(): SKContextValue {
  const ctx = useContext(SignalKContext);
  if (!ctx) throw new Error("useSK must be used within SignalKProvider");
  return ctx;
}
