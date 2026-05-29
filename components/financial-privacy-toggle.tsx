"use client";

import { useEffect, useState } from "react";
import { Eye, EyeOff } from "lucide-react";

const storageKey = "dorighetto_hide_financial_values";

export function FinancialPrivacyToggle() {
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    const saved = window.localStorage.getItem(storageKey) === "true";
    setHidden(saved);
    document.documentElement.classList.toggle("hide-financial-values", saved);
  }, []);

  function toggleHidden() {
    const next = !hidden;
    setHidden(next);
    window.localStorage.setItem(storageKey, String(next));
    document.documentElement.classList.toggle("hide-financial-values", next);
  }

  return (
    <button
      className="button secondary privacy-toggle"
      type="button"
      onClick={toggleHidden}
      aria-pressed={hidden}
      title={hidden ? "Mostrar valores" : "Ocultar valores"}
    >
      {hidden ? <EyeOff size={18} /> : <Eye size={18} />}
      {hidden ? "Mostrar valores" : "Ocultar valores"}
    </button>
  );
}
