import { createContext, useContext, ReactNode } from "react";
import { useSignalK } from "./signalk";

type SignalKContextType = ReturnType<typeof useSignalK>;

const SignalKContext = createContext<SignalKContextType | null>(null);

export function SignalKProvider({ children }: { children: ReactNode }) {
  const sk = useSignalK();
  return <SignalKContext.Provider value={sk}>{children}</SignalKContext.Provider>;
}

export function useSK(): SignalKContextType {
  const ctx = useContext(SignalKContext);
  if (!ctx) throw new Error("useSK must be used within SignalKProvider");
  return ctx;
}
