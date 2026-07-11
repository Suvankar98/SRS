"use client";

import React from "react";

export default function CreatedToast({
  docket,
  newCompanyStored = false,
}: {
  docket?: string | null;
  newCompanyStored?: boolean;
}) {
  React.useEffect(() => {
    if (!docket && !newCompanyStored) return;
    const el = document.createElement("div");
    el.className = "fixed top-6 right-6 z-50 rounded-md bg-emerald-600 px-4 py-2 text-white shadow-lg";
    el.textContent = newCompanyStored
      ? `New service created: ${docket}. New company data stored.`
      : `New service created: ${docket}`;
    document.body.appendChild(el);
    const t = setTimeout(() => {
      el.remove();
      const params = new URLSearchParams(window.location.search);
      params.delete("created");
      params.delete("newCompany");
      const base = window.location.pathname;
      const qs = params.toString();
      window.history.replaceState({}, "", qs ? `${base}?${qs}` : base);
    }, 2500);

    return () => {
      clearTimeout(t);
      el.remove();
    };
  }, [docket, newCompanyStored]);

  return null;
}
