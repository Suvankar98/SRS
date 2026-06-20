"use client";

import { useEffect, useState } from "react";

const THEME_KEY = "srs-theme";

export function ThemeToggle() {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    const savedTheme = window.localStorage.getItem(THEME_KEY);
    const nextDark = savedTheme === "dark";

    document.documentElement.classList.toggle("dark", nextDark);
    setIsDark(nextDark);
  }, []);

  function toggleTheme() {
    const nextDark = !isDark;
    setIsDark(nextDark);
    document.documentElement.classList.toggle("dark", nextDark);
    window.localStorage.setItem(THEME_KEY, nextDark ? "dark" : "light");
  }

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      title={isDark ? "Switch to light mode" : "Switch to dark mode"}
      className="fixed right-4 top-4 z-50 inline-flex h-10 items-center gap-2 rounded-full border border-blue-200 bg-white px-3 text-sm font-semibold text-[#003d73] shadow-md transition hover:bg-blue-50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
    >
      <span aria-hidden="true">{isDark ? "☀" : "🌙"}</span>
      <span>{isDark ? "Light" : "Dark"}</span>
    </button>
  );
}
