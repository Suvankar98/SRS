"use client";

import React from "react";

export type SavedCustomerRequest = {
  id: string;
  name: string;
  contactPerson2: string | null;
  phoneNumber1: string;
  phoneNumber2: string | null;
  area: string;
  fullAddress: string;
  createdAtLabel: string;
};

export type SavedCustomerCompany = {
  company: string;
  detail: SavedCustomerRequest;
};

type SavedCustomerDetailsPanelProps = {
  companies: SavedCustomerCompany[];
  totalRequests: number;
};

export function SavedCustomerDetailsPanel({ companies, totalRequests }: SavedCustomerDetailsPanelProps) {
  const [selectedCompany, setSelectedCompany] = React.useState<SavedCustomerCompany | null>(null);

  return (
    <article className="rounded-[2rem] border border-blue-200 bg-white p-6 shadow-[0_20px_80px_rgba(15,23,42,0.08)]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-blue-950">Saved Customer Details</h2>
          <p className="mt-1 text-sm text-blue-600">Saved against each company name.</p>
        </div>
        <span className="inline-flex rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-blue-700">
          {totalRequests} recent
        </span>
      </div>

      {companies.length === 0 ? (
        <p className="mt-5 rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-700">
          No saved customer details yet.
        </p>
      ) : (
        <div className="mt-5 max-h-[34rem] space-y-2 overflow-y-auto pr-2">
          {companies.map((company) => (
            <button
              key={company.company}
              type="button"
              onClick={() => setSelectedCompany(company)}
              className="flex w-full items-center justify-between gap-3 rounded-2xl border border-blue-200 bg-blue-50/60 px-4 py-3 text-left shadow-sm transition hover:border-blue-400 hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-blue-300"
            >
              <span className="min-w-0 truncate font-semibold text-blue-950">{company.company}</span>
              <span className="shrink-0 rounded-full bg-white px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-blue-700">
                Saved
              </span>
            </button>
          ))}
        </div>
      )}

      {selectedCompany ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4"
          onClick={() => setSelectedCompany(null)}
        >
          <div
            className="max-h-[88vh] w-full max-w-3xl overflow-hidden rounded-3xl border border-blue-200 bg-white shadow-[0_28px_90px_rgba(15,23,42,0.18)]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 border-b border-blue-100 px-5 py-4">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-blue-600">Saved Company</p>
                <h3 className="mt-1 break-words text-xl font-semibold text-blue-950">{selectedCompany.company}</h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedCompany(null)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-blue-200 text-blue-700 transition hover:bg-blue-50"
                aria-label="Close saved company details"
                title="Close"
              >
                x
              </button>
            </div>

            <div className="max-h-[70vh] overflow-y-auto px-5 py-4">
              <div className="rounded-2xl border border-blue-200 bg-blue-50/60 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-blue-950">{selectedCompany.detail.name}</p>
                  <p className="text-xs font-medium text-blue-700">{selectedCompany.detail.createdAtLabel}</p>
                </div>
                <div className="mt-3 grid gap-2 text-xs text-blue-800 sm:grid-cols-2">
                  <p><span className="font-semibold text-blue-950">Contact 1:</span> {selectedCompany.detail.name}</p>
                  <p><span className="font-semibold text-blue-950">Phone 1:</span> {selectedCompany.detail.phoneNumber1}</p>
                  {selectedCompany.detail.contactPerson2 ? (
                    <p><span className="font-semibold text-blue-950">Contact 2:</span> {selectedCompany.detail.contactPerson2}</p>
                  ) : null}
                  {selectedCompany.detail.phoneNumber2 ? (
                    <p><span className="font-semibold text-blue-950">Phone 2:</span> {selectedCompany.detail.phoneNumber2}</p>
                  ) : null}
                  <p><span className="font-semibold text-blue-950">Area:</span> {selectedCompany.detail.area}</p>
                  <p className="sm:col-span-2"><span className="font-semibold text-blue-950">Full Address:</span> {selectedCompany.detail.fullAddress}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </article>
  );
}
