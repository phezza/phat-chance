import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import { useSK } from "./SignalKContext";
import {
  loadUplinkConfig,
  saveUplinkConfig,
  usePositionUplink,
  type UplinkConfig,
  type UplinkStatus,
} from "./usePositionUplink";

interface UplinkContextValue {
  config: UplinkConfig;
  updateConfig: (cfg: UplinkConfig) => void;
  status: UplinkStatus;
}

const UplinkContext = createContext<UplinkContextValue | null>(null);

export function UplinkProvider({ children }: { children: ReactNode }) {
  const { nav } = useSK();
  const [config, setConfigState] = useState<UplinkConfig>(loadUplinkConfig);

  const updateConfig = useCallback((cfg: UplinkConfig) => {
    saveUplinkConfig(cfg);
    setConfigState(cfg);
  }, []);

  const status = usePositionUplink(config, nav);

  return (
    <UplinkContext.Provider value={{ config, updateConfig, status }}>
      {children}
    </UplinkContext.Provider>
  );
}

export function useUplink(): UplinkContextValue {
  const ctx = useContext(UplinkContext);
  if (!ctx) throw new Error("useUplink must be used within UplinkProvider");
  return ctx;
}
