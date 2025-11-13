import React, { createContext, useCallback, useContext, useEffect, useState } from "react";

const DMDrawerContext = createContext(null);

export const DMDrawerProvider = ({ children }) => {
  const [isOpen, setIsOpen] = useState(false);

  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);
  const toggle = useCallback(() => setIsOpen(v => !v), []);

  // Close on ESC
  useEffect(() => {
    const onEsc = (e) => { if (e.key === "Escape") setIsOpen(false); };
    if (isOpen) window.addEventListener("keydown", onEsc);
    return () => window.removeEventListener("keydown", onEsc);
  }, [isOpen]);

  return (
    <DMDrawerContext.Provider value={{ isOpen, open, close, toggle }}>
      {children}
    </DMDrawerContext.Provider>
  );
};

export const useDMDrawer = () => {
  const ctx = useContext(DMDrawerContext);
  if (!ctx) throw new Error("useDMDrawer must be used within DMDrawerProvider");
  return ctx;
};
