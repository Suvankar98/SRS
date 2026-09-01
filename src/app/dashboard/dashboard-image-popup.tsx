"use client";

import React from "react";

type DashboardImagePopupProps = {
  image: {
    fileName: string;
    imageData: string;
  };
};

export function DashboardImagePopup({ image }: DashboardImagePopupProps) {
  const [isOpen, setIsOpen] = React.useState(true);

  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 px-3 py-4 backdrop-blur-sm sm:px-6">
      <div className="relative flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-blue-200 bg-white shadow-2xl">
        <button
          type="button"
          onClick={() => setIsOpen(false)}
          aria-label="Close dashboard image"
          title="Close"
          className="absolute right-3 top-3 z-10 inline-flex h-10 w-10 items-center justify-center rounded-full border border-red-200 bg-white/95 text-red-700 shadow-sm transition hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-300"
        >
          <CloseIcon />
        </button>
        <div className="flex min-h-0 items-center justify-center bg-blue-50 p-3 sm:p-5">
          <img
            src={image.imageData}
            alt={image.fileName}
            className="max-h-[84vh] w-full object-contain"
          />
        </div>
      </div>
    </div>
  );
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" aria-hidden="true">
      <path
        d="M6 6L18 18M18 6L6 18"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}