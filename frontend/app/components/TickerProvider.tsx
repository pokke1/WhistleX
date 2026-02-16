"use client";

import { createContext, useContext, useMemo, useState } from "react";

type TickerContextValue = {
  items: string[];
  setItems: React.Dispatch<React.SetStateAction<string[]>>;
};

const TickerContext = createContext<TickerContextValue | null>(null);

export function TickerProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<string[]>([]);
  const value = useMemo(() => ({ items, setItems }), [items, setItems]);
  return <TickerContext.Provider value={value}>{children}</TickerContext.Provider>;
}

export function useTicker() {
  const ctx = useContext(TickerContext);
  if (!ctx) {
    throw new Error("useTicker must be used within a TickerProvider");
  }
  return ctx;
}
