"use client";

import React from "react";

import { normalizeStatus } from "../status-utils";
import { formatDocketNumber } from "@/lib/docket";

type ReviewNoteRequest = {
  id: string;
  docketNumber: string;
  company: string;
  name: string;
  status: string | null;
  reviewNotes?: ReviewNoteEntry[];
};

type ReviewNoteEntry = {
  id: string;
  employeeName: string;
  status: ReturnType<typeof normalizeStatus>;
  note: string;
  submittedAt: Date | string | null | undefined;
};

export function ReviewNoteButton({ request }: { request: ReviewNoteRequest }) {
  const [open, setOpen] = React.useState(false);
  const notes = getReviewNotes(request);

  if (notes.length === 0) {
    return null;
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-1 inline-flex items-center gap-1 text-[11px] font-medium text-blue-600 underline decoration-blue-300 underline-offset-2 transition hover:text-blue-800"
      >
        <NoteIcon />
        Review Note
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setOpen(false)}>
          <div
            className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-2xl border border-blue-200 bg-white p-5 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-4 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="text-sm font-semibold text-blue-950">Review Note</h3>
                <p className="mt-1 text-xs font-bold text-blue-700">{formatDocketNumber(request.docketNumber)}</p>
                <p className="mt-0.5 break-words text-xs font-medium text-slate-600">{request.company}</p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-lg border border-red-200 bg-red-50 p-1 text-red-700 transition hover:bg-red-100 focus:outline-none focus:ring-2 focus:ring-red-200"
                aria-label="Close review note"
                title="Close"
              >
                <CloseIcon />
              </button>
            </div>

            <div className="space-y-3">
              {notes.map((note) => (
                <article key={note.id} className="rounded-xl border border-blue-100 bg-blue-50/60 p-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-blue-950">{note.employeeName}</p>
                      {note.submittedAt ? <p className="mt-1 text-[11px] font-medium text-blue-600">{formatReviewNoteDate(note.submittedAt)}</p> : null}
                    </div>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${getStatusClass(note.status)}`}>
                      {note.status}
                    </span>
                  </div>
                  <p className="mt-2 whitespace-pre-wrap break-words rounded-lg bg-white px-3 py-2 text-sm leading-relaxed text-blue-900 ring-1 ring-inset ring-blue-100">
                    {note.note}
                  </p>
                </article>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

export function getReviewNotes(request: ReviewNoteRequest): ReviewNoteEntry[] {
  return request.reviewNotes?.filter((note) => note.note.trim()) ?? [];
}

function getStatusClass(status: ReturnType<typeof normalizeStatus>) {
  switch (status) {
    case "Completed":
      return "bg-emerald-100 text-emerald-800";
    case "Cancel":
      return "bg-red-100 text-red-800";
    case "In Process":
      return "bg-amber-100 text-amber-800";
    case "New Call":
    default:
      return "bg-blue-100 text-blue-800";
  }
}


function formatReviewNoteDate(value: Date | string) {
  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function NoteIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" className="h-3 w-3 shrink-0" aria-hidden="true">
      <path d="M4 3.5h8M4 6.5h8M4 9.5h5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M3 2.5h10v11H3v-11Z" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4" aria-hidden="true">
      <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
    </svg>
  );
}


