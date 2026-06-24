"use client";

import React from "react";
import { updateServiceRequestDetails } from "./actions";

type SimpleOption = {
  id: string;
  name: string;
};

type RequestDetails = {
  id: string;
  docketNumber: string;
  name: string;
  company: string;
  phoneNumber1: string;
  phoneNumber2: string | null;
  fullAddress: string;
  complaintDetails: string | null;
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
  const [complaintDetails, setComplaintDetails] = React.useState(request.complaintDetails || "");
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
    formData.append("complaintDetails", complaintDetails);
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
        className="font-semibold text-blue-800 underline decoration-blue-300 underline-offset-2 transition hover:text-blue-600"
      >
        {request.docketNumber}
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4">
          <div className="my-4 w-full max-w-4xl rounded-[2rem] border border-blue-200 bg-white shadow-[0_20px_80px_rgba(15,23,42,0.12)]">
            <div className="sticky top-0 z-10 border-b border-blue-200 bg-white px-5 py-4 sm:px-6">
              <h3 className="text-2xl font-semibold tracking-tight text-blue-950">
                Docket Details
              </h3>
              <p className="text-sm leading-6 text-blue-600">{request.docketNumber}</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6 p-5 sm:p-6">
              <div className="grid gap-4 sm:gap-5 md:grid-cols-2">
                <GridField label="Name">
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  readOnly={!canEdit}
                  required
                  className="w-full rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-blue-950 outline-none transition placeholder:text-blue-400 focus:border-blue-400 focus:bg-white"
                />
              </GridField>

                <GridField label="Company">
                <input
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                  readOnly={!canEdit}
                  required
                  className="w-full rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-blue-950 outline-none transition placeholder:text-blue-400 focus:border-blue-400 focus:bg-white"
                />
              </GridField>

                <GridField label="Phone Number 1">
                  <input
                    value={phoneNumber1}
                    onChange={(e) => setPhoneNumber1(e.target.value)}
                    readOnly={!canEdit}
                    required
                    className="w-full rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-blue-950 outline-none transition placeholder:text-blue-400 focus:border-blue-400 focus:bg-white"
                  />
                </GridField>

                <GridField label="Phone Number 2">
                  <input
                    value={phoneNumber2}
                    onChange={(e) => setPhoneNumber2(e.target.value)}
                    readOnly={!canEdit}
                    className="w-full rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-blue-950 outline-none transition placeholder:text-blue-400 focus:border-blue-400 focus:bg-white"
                  />
                </GridField>

                <GridField label="Area">
                  {canEdit ? (
                    <select
                      value={area}
                      onChange={(e) => setArea(e.target.value)}
                      className="w-full rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-blue-950 outline-none transition focus:border-blue-400 focus:bg-white"
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
                      className="w-full rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-blue-950"
                    />
                  )}
                </GridField>

                <GridField label="Product">
                  {canEdit ? (
                    <select
                      value={product}
                      onChange={(e) => setProduct(e.target.value)}
                      className="w-full rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-blue-950 outline-none transition focus:border-blue-400 focus:bg-white"
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
                      className="w-full rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-blue-950"
                    />
                  )}
                </GridField>

                <GridField label="Call Type">
                  {canEdit ? (
                    <select
                      value={callType}
                      onChange={(e) => setCallType(e.target.value)}
                      className="w-full rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-blue-950 outline-none transition focus:border-blue-400 focus:bg-white"
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
                      className="w-full rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-blue-950"
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
                  className="w-full rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-blue-950 outline-none transition placeholder:text-blue-400 focus:border-blue-400 focus:bg-white"
                />
              </GridField>

              <GridField label="Complaint Details">
                <textarea
                  rows={3}
                  value={complaintDetails}
                  onChange={(e) => setComplaintDetails(e.target.value)}
                  readOnly={!canEdit}
                  required
                  className="w-full rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-blue-950 outline-none transition placeholder:text-blue-400 focus:border-blue-400 focus:bg-white"
                />
              </GridField>

              <div className="flex flex-col-reverse gap-3 border-t border-blue-200 pt-5 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="inline-flex items-center justify-center rounded-full border border-blue-200 px-5 py-3 text-sm font-medium text-blue-700 transition hover:bg-blue-50"
                >
                  Close
                </button>
                {canEdit && (
                  <button
                    type="submit"
                    className="inline-flex items-center justify-center rounded-full bg-blue-950 px-6 py-3 text-sm font-medium text-white transition hover:bg-blue-800"
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
      <span className="mb-2 block text-sm font-medium text-blue-700">
        {label}
      </span>
      {children}
    </label>
  );
}

