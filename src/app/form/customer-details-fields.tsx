"use client";

import React from "react";

import { PhoneNumberInput } from "../phone-number-input";
import { AreaAutocomplete } from "./area-autocomplete";

export type SavedCompanyOption = {
  company: string;
  name: string;
  contactPerson2: string | null;
  phoneNumber1: string;
  phoneNumber2: string | null;
  area: string;
  fullAddress: string;
};

type CustomerDetailsFieldsProps = {
  savedCompanies: SavedCompanyOption[];
};

export function CustomerDetailsFields({ savedCompanies }: CustomerDetailsFieldsProps) {
  const [company, setCompany] = React.useState("");
  const [name, setName] = React.useState("");
  const [contactPerson2, setContactPerson2] = React.useState("");
  const [phoneNumber1, setPhoneNumber1] = React.useState("");
  const [phoneNumber2, setPhoneNumber2] = React.useState("");
  const [area, setArea] = React.useState("");
  const [fullAddress, setFullAddress] = React.useState("");
  const [showSecondContact, setShowSecondContact] = React.useState(false);
  const [showCompanyOptions, setShowCompanyOptions] = React.useState(false);

  const filteredCompanies = React.useMemo(() => {
    const query = company.trim().toLowerCase();
    if (!query) {
      return [];
    }

    const compactQuery = getSavedCompanySearchKey(query);

    return savedCompanies
      .filter((option) => {
        const searchText = getSavedCompanySearchText(option);
        return searchText.includes(query) || getSavedCompanySearchKey(searchText).includes(compactQuery);
      })
      .slice(0, 10);
  }, [company, savedCompanies]);

  const handleSelectCompany = (option: SavedCompanyOption) => {
    setCompany(option.company);
    setName(option.name);
    setContactPerson2(option.contactPerson2 ?? "");
    setPhoneNumber1(option.phoneNumber1);
    setPhoneNumber2(option.phoneNumber2 ?? "");
    setArea(option.area);
    setFullAddress(option.fullAddress);
    setShowSecondContact(Boolean(option.contactPerson2 || option.phoneNumber2));
    setShowCompanyOptions(false);
  };

  return (
    <>
      <div className="relative md:col-span-2">
        <label>
          <span className="mb-2 block text-sm font-medium text-blue-700">Customer Name / Company Name</span>
          <input
            name="company"
            value={company}
            onChange={(event) => {
              setCompany(event.target.value);
              setShowCompanyOptions(true);
            }}
            onFocus={() => setShowCompanyOptions(true)}
            onBlur={() => window.setTimeout(() => setShowCompanyOptions(false), 150)}
            placeholder="Enter customer or company name"
            autoComplete="off"
            className="w-full rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-blue-950 outline-none transition placeholder:text-blue-400 focus:border-blue-400 focus:bg-white"
            required
          />
        </label>

        {showCompanyOptions && filteredCompanies.length > 0 ? (
          <div className="absolute left-0 right-0 z-20 mt-2 max-h-80 overflow-y-auto rounded-2xl border border-blue-200 bg-white p-2 shadow-xl">
            {filteredCompanies.map((option) => (
              <button
                key={option.company}
                type="button"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => handleSelectCompany(option)}
                className="block w-full rounded-xl px-3 py-2.5 text-left transition hover:bg-blue-50 focus:bg-blue-50 focus:outline-none"
              >
                <span className="block break-words text-sm font-semibold leading-5 text-blue-950">{option.company}</span>
                <span className="mt-1 block break-words text-xs font-semibold leading-5 text-slate-950">
                  {formatSavedCustomerContact(option)}
                </span>
                <span className="mt-1 block break-words text-xs leading-5 text-blue-700">
                  {formatSavedCustomerLocation(option)}
                </span>
              </button>
            ))}
          </div>
        ) : null}
      </div>

      <div className="md:col-span-2">
        <div className="grid gap-4 rounded-2xl bg-slate-50 p-4 sm:gap-5 md:grid-cols-2">
          <Field label="Contact Person 1" name="name" value={name} onChange={setName} placeholder="Enter contact person name" />
          <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_3rem] sm:items-end">
            <PhoneNumberInput
              label="Ph No. - Contact 1"
              name="phoneNumber1"
              value={phoneNumber1}
              onChange={setPhoneNumber1}
              required
            />
            <button
              type="button"
              onClick={() => setShowSecondContact(true)}
              className="inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-blue-300 bg-white text-2xl font-semibold leading-none text-blue-700 shadow-sm transition hover:border-blue-500 hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-blue-300"
              aria-label="Add another contact"
              title="Add another contact"
            >
              +
            </button>
          </div>

          {showSecondContact ? (
            <>
              <Field label="Contact Person 2" name="contactPerson2" value={contactPerson2} onChange={setContactPerson2} placeholder="Enter contact person name" required={false} />
              <PhoneNumberInput
                label="Ph No. - Contact 2"
                name="phoneNumber2"
                value={phoneNumber2}
                onChange={setPhoneNumber2}
              />
            </>
          ) : null}
        </div>
      </div>

      <AreaAutocomplete value={area} onChange={setArea} />
      <label>
        <span className="mb-2 block text-sm font-medium text-blue-700">Full Address</span>
        <textarea
          name="fullAddress"
          value={fullAddress}
          onChange={(event) => setFullAddress(event.target.value)}
          rows={2}
          placeholder="Street, building, landmark, city, postal code"
          className="w-full min-h-[3.5rem] max-h-56 resize-y rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-blue-950 outline-none transition placeholder:text-blue-400 focus:border-blue-400 focus:bg-white"
          required
        />
      </label>
    </>
  );
}

function getSavedCompanySearchText(option: SavedCompanyOption) {
  return [
    option.company,
    option.name,
    option.contactPerson2,
    option.phoneNumber1,
    option.phoneNumber2,
    option.area,
    option.fullAddress,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function getSavedCompanySearchKey(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function formatSavedCustomerContact(option: SavedCompanyOption) {
  const primaryContact = [option.name, option.phoneNumber1].filter(Boolean).join(" -> ");
  const secondaryContact = [option.contactPerson2, option.phoneNumber2].filter(Boolean).join(" -> ");
  return [primaryContact, secondaryContact].filter(Boolean).join(" | ") || "No contact details saved";
}

function formatSavedCustomerLocation(option: SavedCompanyOption) {
  const area = option.area ? `Area: ${option.area}` : "";
  return [area, option.fullAddress].filter(Boolean).join(" | ") || "No address saved";
}

type FieldProps = {
  label: string;
  name: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  type?: string;
  required?: boolean;
};

function Field({ label, name, value, onChange, placeholder, type = "text", required = true }: FieldProps) {
  return (
    <label>
      <span className="mb-2 block text-sm font-medium text-blue-700">{label}</span>
      <input
        name={name}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        type={type}
        placeholder={placeholder}
        inputMode={type === "tel" ? "tel" : undefined}
        className="w-full rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-blue-950 outline-none transition placeholder:text-blue-400 focus:border-blue-400 focus:bg-white"
        required={required}
      />
    </label>
  );
}
