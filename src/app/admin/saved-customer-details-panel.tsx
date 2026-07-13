"use client";

import { useRouter } from "next/navigation";
import React from "react";

import { importSavedCustomerDetails, updateSavedCustomerDetails } from "../actions";

export type SavedCustomerRequest = {
  id: string;
  source: "serviceRequest" | "savedCustomer";
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

const CSV_HEADERS = ["Company Name", "Name", "Phone Number", "Area", "Full Address"] as const;

export function SavedCustomerDetailsPanel({ companies, totalRequests }: SavedCustomerDetailsPanelProps) {
  const router = useRouter();
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);
  const [selectedCompany, setSelectedCompany] = React.useState<SavedCustomerCompany | null>(null);
  const [isEditing, setIsEditing] = React.useState(false);
  const [isImporting, startImportTransition] = React.useTransition();
  const [importMessage, setImportMessage] = React.useState<string | null>(null);

  const selectedDetail = selectedCompany?.detail;

  function downloadCustomerCsv() {
    const csvRows = [
      CSV_HEADERS,
      ...companies.map((company) => [
        company.company,
        company.detail.name,
        company.detail.phoneNumber1,
        company.detail.area,
        company.detail.fullAddress,
      ]),
    ];
    const csv = csvRows.map((row) => row.map(escapeCsvValue).join(",")).join("\r\n");
    const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = "saved-customer-details.csv";
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  function handleUploadClick() {
    setImportMessage(null);
    fileInputRef.current?.click();
  }

  async function handleFileUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    const formData = new FormData();
    formData.set("file", file);

    startImportTransition(async () => {
      const result = await importSavedCustomerDetails(formData);
      setImportMessage(`${result.message}${result.skipped ? ` ${result.skipped} row${result.skipped === 1 ? "" : "s"} skipped.` : ""}`);
      router.refresh();
    });

    event.target.value = "";
  }

  async function saveSelectedCustomer(formData: FormData) {
    await updateSavedCustomerDetails(formData);
    const company = String(formData.get("company") ?? "").trim();
    const name = String(formData.get("name") ?? "").trim();
    const phoneNumber1 = String(formData.get("phoneNumber1") ?? "").trim();
    const area = String(formData.get("area") ?? "").trim();
    const fullAddress = String(formData.get("fullAddress") ?? "").trim();

    if (selectedCompany) {
      setSelectedCompany({
        company,
        detail: {
          ...selectedCompany.detail,
          name,
          phoneNumber1,
          area,
          fullAddress,
        },
      });
    }

    setIsEditing(false);
    router.refresh();
  }

  function closeModal() {
    setSelectedCompany(null);
    setIsEditing(false);
  }

  return (
    <article className="rounded-[2rem] border border-blue-200 bg-white p-6 shadow-[0_20px_80px_rgba(15,23,42,0.08)]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-blue-950">Saved Customer Details</h2>
          <p className="mt-1 text-sm text-blue-600">Saved against each company name.</p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <button
            type="button"
            onClick={handleUploadClick}
            disabled={isImporting}
            className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-white px-3 py-2 text-xs font-semibold text-blue-700 transition hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <UploadIcon />
            {isImporting ? "Uploading" : "Upload Excel"}
          </button>
          <button
            type="button"
            onClick={downloadCustomerCsv}
            disabled={companies.length === 0}
            className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-950 px-3 py-2 text-xs font-semibold text-white transition hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <DownloadIcon />
            Download Excel
          </button>
          <span className="inline-flex rounded-full bg-blue-100 px-3 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-blue-700">
            {totalRequests} recent
          </span>
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept=".csv,.xls,.xlsx,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        className="hidden"
        onChange={handleFileUpload}
      />

      {importMessage ? (
        <p className="mt-4 rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm font-medium text-blue-700">
          {importMessage}
        </p>
      ) : null}

      {companies.length === 0 ? (
        <p className="mt-5 rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-700">
          No saved customer details yet.
        </p>
      ) : (
        <div className="mt-5 max-h-[34rem] space-y-2 overflow-y-auto pr-2">
          {companies.map((company) => {
            const missingCount = getMissingFieldCount(company);

            return (
              <button
                key={company.company}
                type="button"
                onClick={() => {
                  setSelectedCompany(company);
                  setIsEditing(false);
                }}
                className="flex w-full items-center justify-between gap-3 rounded-2xl border border-blue-200 bg-blue-50/60 px-4 py-3 text-left shadow-sm transition hover:border-blue-400 hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-blue-300"
              >
                <span className="min-w-0 truncate font-semibold text-blue-950">{company.company}</span>
                <span className="flex shrink-0 items-center gap-2">
                  {missingCount > 0 ? (
                    <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-amber-700">
                      {missingCount} missing
                    </span>
                  ) : null}
                  <span className="rounded-full bg-white px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-blue-700">
                    Saved
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      )}

      {selectedCompany && selectedDetail ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4" onClick={closeModal}>
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
                onClick={closeModal}
                className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-rose-200 text-rose-600 transition hover:bg-rose-50"
                aria-label="Close saved company details"
                title="Close"
              >
                x
              </button>
            </div>

            <div className="max-h-[70vh] overflow-y-auto px-5 py-4">
              {isEditing ? (
                <form action={saveSelectedCustomer} className="rounded-2xl border border-blue-200 bg-blue-50/60 p-4">
                  <input type="hidden" name="requestId" value={selectedDetail.id} />
                  <input type="hidden" name="source" value={selectedDetail.source} />
                  <div className="grid gap-3 sm:grid-cols-2">
                    <CustomerInput label="Company Name" name="company" defaultValue={selectedCompany.company} />
                    <CustomerInput label="Name" name="name" defaultValue={selectedDetail.name} />
                    <CustomerInput label="Phone Number" name="phoneNumber1" defaultValue={selectedDetail.phoneNumber1} />
                    <CustomerInput label="Area" name="area" defaultValue={selectedDetail.area} />
                    <label className="sm:col-span-2">
                      <span className="text-xs font-semibold uppercase tracking-[0.12em] text-blue-700">Full Address</span>
                      <textarea
                        name="fullAddress"
                        defaultValue={selectedDetail.fullAddress}
                        rows={4}
                        required
                        className="mt-1 w-full resize-none rounded-2xl border border-blue-200 bg-white px-3 py-2 text-sm font-medium text-blue-950 outline-none transition focus:border-blue-400"
                      />
                    </label>
                  </div>
                  <div className="mt-4 flex flex-wrap justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setIsEditing(false)}
                      className="rounded-2xl border border-blue-200 bg-white px-4 py-2 text-sm font-semibold text-blue-700 transition hover:bg-blue-50"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="rounded-2xl bg-blue-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-800"
                    >
                      Save details
                    </button>
                  </div>
                </form>
              ) : (
                <div className="rounded-2xl border border-blue-200 bg-blue-50/60 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-blue-950">{selectedDetail.name || "Name missing"}</p>
                      <p className="mt-1 text-xs font-medium text-blue-700">{selectedDetail.createdAtLabel}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsEditing(true)}
                      className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-white px-3 py-2 text-xs font-semibold text-blue-700 transition hover:bg-blue-50"
                    >
                      <EditIcon />
                      Edit
                    </button>
                  </div>
                  <div className="mt-4 grid gap-3 text-sm text-blue-900 sm:grid-cols-2">
                    <CustomerValue label="Company Name" value={selectedCompany.company} />
                    <CustomerValue label="Name" value={selectedDetail.name} />
                    <CustomerValue label="Phone Number" value={selectedDetail.phoneNumber1} />
                    <CustomerValue label="Area" value={selectedDetail.area} />
                    <CustomerValue label="Full Address" value={selectedDetail.fullAddress} wide />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </article>
  );
}

function CustomerInput({ label, name, defaultValue }: { label: string; name: string; defaultValue: string }) {
  return (
    <label>
      <span className="text-xs font-semibold uppercase tracking-[0.12em] text-blue-700">{label}</span>
      <input
        name={name}
        defaultValue={defaultValue}
        required
        className="mt-1 w-full rounded-2xl border border-blue-200 bg-white px-3 py-2 text-sm font-medium text-blue-950 outline-none transition focus:border-blue-400"
      />
    </label>
  );
}

function CustomerValue({ label, value, wide = false }: { label: string; value: string; wide?: boolean }) {
  const hasValue = value.trim() !== "";

  return (
    <p className={wide ? "sm:col-span-2" : ""}>
      <span className="block text-[10px] font-semibold uppercase tracking-[0.12em] text-blue-600">{label}</span>
      <span className={hasValue ? "font-semibold text-blue-950" : "font-semibold text-amber-700"}>
        {hasValue ? value : "Missing"}
      </span>
    </p>
  );
}

function getMissingFieldCount(company: SavedCustomerCompany) {
  const values = [
    company.company,
    company.detail.name,
    company.detail.phoneNumber1,
    company.detail.area,
    company.detail.fullAddress,
  ];

  return values.filter((value) => value.trim() === "").length;
}

function escapeCsvValue(value: string) {
  return `"${value.replace(/"/g, '""')}"`;
}

function UploadIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden="true">
      <path d="M12 16V4M7.5 8.5 12 4l4.5 4.5M5 20h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function DownloadIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden="true">
      <path d="M12 4v12M7.5 11.5 12 16l4.5-4.5M5 20h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function EditIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden="true">
      <path
        d="M4 20H8L18.5 9.5C19.33 8.67 19.33 7.33 18.5 6.5C17.67 5.67 16.33 5.67 15.5 6.5L5 17V20H4ZM14.5 7.5L17.5 10.5"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
