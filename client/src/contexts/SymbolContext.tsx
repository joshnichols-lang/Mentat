import { createContext, useContext, useState, ReactNode } from "react";

interface SymbolContextType {
  selectedSymbol: string;
  setSelectedSymbol: (symbol: string) => void;
}

const SymbolContext = createContext<SymbolContextType | undefined>(undefined);

export function SymbolProvider({ children }: { children: ReactNode }) {
  const [selectedSymbol, setSelectedSymbol] = useState("BINANCE:BTCUSDT");

  return (
    <SymbolContext.Provider value={{ selectedSymbol, setSelectedSymbol }}>
      {children}
    </SymbolContext.Provider>
  );
}

export function useSymbol() {
  const context = useContext(SymbolContext);
  if (!context) {
    throw new Error("useSymbol must be used within a SymbolProvider");
  }
  return context;
}
