import { createContext, useContext, useState, useCallback, ReactNode } from "react";
import { useSignalK } from "./signalk";
import { useNMEAProxy } from "./useNMEAProxy";
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
  nmeaLog?: string[];
}

const SignalKContext = createContext<SKContextValue | null>(null);

function SignalKModeProvider({ config, updateConfig, children }: {
  config: SignalKConfig;
  updateConfig: (c: SignalKConfig) => void;
  children: ReactNode;
}) {
  const sk = useSignalK(config);
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
