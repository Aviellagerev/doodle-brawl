"use client";

import { useEffect, useState } from "react";


export default function ThemeToggle() {
  const [theme, setTheme] = useState<"light" | "dark" | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem("theme");
    if (saved === "light" || saved === "dark") {
      document.documentElement.dataset.theme = saved;
      setTheme(saved);
    } else {
      // light is the default until the user opts into dark
      setTheme("light");
    }
  }, []);

  const toggle = () => {
    const next = theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    localStorage.setItem("theme", next);
    setTheme(next);
  };

  return (
    <button
      onClick={toggle}
      aria-label="Toggle light / dark"
      className="font-bold cursor-pointer bg-card text-ink"
      style={{ border: "2.5px solid var(--outline)", borderRadius: 12, boxShadow: "3px 3px 0 var(--outline)", padding: "8px 13px", fontSize: 14 }}
    >
      {theme === "dark" ? "☾" : "☀"}
    </button>
  );
}
