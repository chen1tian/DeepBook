"use client";

import { createContext, useContext, useState, type ReactNode } from "react";

interface ViewContextType {
  showPresets: boolean;
  togglePresets: () => void;
  showPersonas: boolean;
  togglePersonas: () => void;
}

const ViewContext = createContext<ViewContextType>({
  showPresets: false,
  togglePresets: () => {},
  showPersonas: false,
  togglePersonas: () => {},
});

export function ViewProvider({ children }: { children: ReactNode }) {
  const [showPresets, setShowPresets] = useState(false);
  const [showPersonas, setShowPersonas] = useState(false);

  function togglePresets() {
    setShowPresets((v) => !v);
    setShowPersonas(false);
  }

  function togglePersonas() {
    setShowPersonas((v) => !v);
    setShowPresets(false);
  }

  return (
    <ViewContext.Provider value={{ showPresets, togglePresets, showPersonas, togglePersonas }}>
      {children}
    </ViewContext.Provider>
  );
}

export function useView() {
  return useContext(ViewContext);
}
