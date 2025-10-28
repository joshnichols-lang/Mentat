import { createContext, useContext, useLayoutEffect, useState } from "react";

type ThemeMode = "light" | "dark";
type ThemeName = "fox" | "cyber" | "matrix";

interface ThemeContextType {
  mode: ThemeMode;
  themeName: ThemeName;
  setMode: (mode: ThemeMode) => void;
  setThemeName: (name: ThemeName) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setMode] = useState<ThemeMode>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("themeMode") as ThemeMode | null;
      return saved || "dark";
    }
    return "dark";
  });

  const [themeName, setThemeName] = useState<ThemeName>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("themeName") as ThemeName | null;
      return saved || "fox";
    }
    return "fox";
  });

  useLayoutEffect(() => {
    const root = document.documentElement;
    
    // Remove all theme classes
    root.classList.remove("light", "dark", "fox", "cyber", "matrix");
    
    // Add current theme classes
    root.classList.add(mode);
    root.classList.add(themeName);
    
    // Persist to localStorage
    localStorage.setItem("themeMode", mode);
    localStorage.setItem("themeName", themeName);
  }, [mode, themeName]);

  return (
    <ThemeContext.Provider value={{ mode, themeName, setMode, setThemeName }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return context;
}
