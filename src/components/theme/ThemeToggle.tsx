"use client";

import React from "react";
import { useTheme } from "./ThemeProvider";

export function ThemeToggle() {
  const { isDark, toggle } = useTheme();
  return (
    <button
      onClick={toggle}
      className="inline-flex items-center gap-2 rounded-xl border border-zinc-800/60 px-3 py-2 text-sm hover:bg-zinc-900"
      title={isDark ? "Mudar para claro" : "Mudar para escuro"}
      aria-label="Alternar tema"
    >
      <span className="inline-block h-4 w-4 rounded-full" style={{ backgroundColor: isDark ? "#f5f5f5" : "#0a0a0a" }} />
      {isDark ? "Escuro" : "Claro"}
    </button>
  );
}
