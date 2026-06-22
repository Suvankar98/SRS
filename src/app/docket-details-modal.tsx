"use client";

import React from "react";
import { updateServiceRequestDetails } from "./actions";

type SimpleOption = {
  id: number;
  name: string;
};

type RequestDetails = {
  id: number;
  docketNumber: string;
  name: string;
  company: string;
  phoneNumber1: string;
  phoneNumber2: string | null;
  fullAddress: string;
  area: string;
  product: string;
  callType: string;
};

const AREAS = [
  "Alipore",
  "Ballygunge",
  "Baghajatin",
  "Behala",
  "Bhowanipore",
  "Dum Dum",
  "EM Bypass",
  "Esplanade",
  "Garia",
  "Jadavpur",
  "Kalighat",
  "Kasba",
  "Kidderpore",
  "Lake Town",
  "New Alipore",
  "Park Circus",
  "Park Street",
  "Rajarhat",
  "Salt Lake",
  "Sealdah",
  "Shyambazar",
  "Tollygunge",
];

export function DocketDetailsModal({
  request,
  canEdit,
  products,
  callTypes,
}: {
  request: RequestDetails;
  canEdit: boolean;
  products: SimpleOption[];
  callTypes: SimpleOption[];
}) {
  const [isOpen, setIsOpen] = React.useState(false);
  const [name, setName] = React.useState(request.name);
  const [company, setCompany] = React.useState(request.company);
  const [phoneNumber1, setPhoneNumber1] = React.useState(request.phoneNumber1);
  const [phoneNumber2, setPhoneNumber2] = React.useState(request.phoneNumber2 || "");
  const [fullAddress, setFullAddress] = React.useState(request.fullAddress);
  const [area, setArea] = React.useState(request.area);
  const [product, setProduct] = React.useState(request.product);
  const [callType, setCallType] = React.useState(request.callType);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!canEdit) {
      return;
    }

    const formData = new FormData();
    formData.append("requestId", String(request.id));
    formData.append("name", name);
    formData.append("company", company);
    formData.append("phoneNumber1", phoneNumber1);
    formData.append("phoneNumber2", phoneNumber2);
    formData.append("fullAddress", fullAddress);
    formData.append("area", area);
    formData.append("product", product);
    formData.append("callType", callType);

    await updateServiceRequestDetails(formData);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="font-semibold text-blue-800 underline decoration-blue-300 underline-offset-2 transition hover:text-blue-600 dark:text-sky-300"
      >
        {request.docketNumber}
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-blue-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900">
            <div className="sticky top-0 z-10 border-b border-blue-200 bg-white px-5 py-4 dark:border-slate-700 dark:bg-slate-900">
              <h3 className="text-lg font-semibold text-blue-950 dark:text-slate-100">
                Docket Details
              </h3>
              <p className="text-sm text-blue-600 dark:text-slate-300">{request.docketNumber}</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 p-5">
              <GridField label="Name">
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  readOnly={!canEdit}
                  required
                  className="w-full rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-900 outline-none focus:border-blue-400 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                />
              </GridField>

              <GridField label="Company">
                <input
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                  readOnly={!canEdit}
                  required
                  className="w-full rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-900 outline-none focus:border-blue-400 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                />
              </GridField>

              <div className="grid gap-4 sm:grid-cols-2">
                <GridField label="Phone Number 1">
                  <input
                    value={phoneNumber1}
                    onChange={(e) => setPhoneNumber1(e.target.value)}
                    readOnly={!canEdit}
                    required
                    className="w-full rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-900 outline-none focus:border-blue-400 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                  />
                </GridField>

                <GridField label="Phone Number 2">
                  <input
                    value={phoneNumber2}
                    onChange={(e) => setPhoneNumber2(e.target.value)}
                    readOnly={!canEdit}
                    className="w-full rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-900 outline-none focus:border-blue-400 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                  />
                </GridField>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <GridField label="Area">
                  {canEdit ? (
                    <select
                      value={area}
                      onChange={(e) => setArea(e.target.value)}
                      className="w-full rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-900 outline-none focus:border-blue-400 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                    >
                      {AREAS.map((item) => (
                        <option key={item} value={item}>
                          {item}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      value={area}
                      readOnly
                      className="w-full rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-900 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                    />
                  )}
                </GridField>

                <GridField label="Product">
                  {canEdit ? (
                    <select
                      value={product}
                      onChange={(e) => setProduct(e.target.value)}
                      className="w-full rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-900 outline-none focus:border-blue-400 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                    >
                      {products.map((item) => (
                        <option key={item.id} value={item.name}>
                          {item.name}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      value={product}
                      readOnly
                      className="w-full rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-900 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                    />
                  )}
                </GridField>

                <GridField label="Call Type">
                  {canEdit ? (
                    <select
                      value={callType}
                      onChange={(e) => setCallType(e.target.value)}
                      className="w-full rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-900 outline-none focus:border-blue-400 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                    >
                      {callTypes.map((item) => (
                        <option key={item.id} value={item.name}>
                          {item.name}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      value={callType}
                      readOnly
                      className="w-full rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-900 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                    />
                  )}
                </GridField>
              </div>

              <GridField label="Full Address">
                <textarea
                  rows={4}
                  value={fullAddress}
                  onChange={(e) => setFullAddress(e.target.value)}
                  readOnly={!canEdit}
                  required
                  className="w-full rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-900 outline-none focus:border-blue-400 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                />
              </GridField>

              <div className="flex flex-col-reverse gap-2 border-t border-blue-200 pt-4 sm:flex-row sm:justify-end dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="rounded-lg border border-blue-200 px-4 py-2 text-sm font-medium text-blue-700 transition hover:bg-blue-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  Close
                </button>
                {canEdit && (
                  <button
                    type="submit"
                    className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-800 dark:bg-sky-600 dark:hover:bg-sky-500"
                  >
                    Save Changes
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

function GridField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium uppercase tracking-[0.12em] text-blue-600 dark:text-slate-300">
        {label}
      </span>
      {children}
    </label>
  );
}
