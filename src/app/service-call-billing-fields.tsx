"use client";

import React from "react";
import { CALL_TYPE_OPTIONS } from "@/lib/service-request-options";

type BillingType = "warranty" | "amc" | "chargeable";
const BILLING_TYPE_OPTIONS: Array<{ id: BillingType; label: string }> = [
  { id: "warranty", label: "Warranty" },
  { id: "amc", label: "AMC" },
  { id: "chargeable", label: "Chargeable" },
];

export function ServiceCallBillingFields() {
  const [callType, setCallType] = React.useState("");
  const [serviceBillingType, setServiceBillingType] = React.useState<BillingType | "">("");
  const [chargeableAmount, setChargeableAmount] = React.useState("");

  const isServiceCall = callType === "Service";
  const isChargeable = isServiceCall && serviceBillingType === "chargeable";

  const handleCallTypeChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const nextCallType = event.target.value;
    setCallType(nextCallType);

    if (nextCallType !== "Service") {
      setServiceBillingType("");
      setChargeableAmount("");
    }
  };

  const handleBillingTypeToggle = (billingType: BillingType) => {
    setServiceBillingType((currentValue) => {
      if (currentValue === billingType) {
        return "";
      }

      if (billingType !== "chargeable") {
        setChargeableAmount("");
      }

      return billingType;
    });
  };

  return (
    <div className="md:col-span-2">
      <label className="block">
        <span className="mb-2 block text-sm font-medium text-blue-700">Call Type</span>
        <select
          name="callType"
          className="w-full rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-blue-950 outline-none transition focus:border-blue-400 focus:bg-white"
          value={callType}
          onChange={handleCallTypeChange}
          required
        >
          <option value="" disabled>
            Select a call type
          </option>
          {CALL_TYPE_OPTIONS.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
      </label>

      {isServiceCall ? (
        <div className="mt-4 rounded-2xl border border-blue-200 bg-blue-50/60 p-4">
          <span className="mb-3 block text-sm font-medium text-blue-700">Service Type</span>
          <div className="flex flex-wrap gap-4">
            {BILLING_TYPE_OPTIONS.map((option) => (
              <label key={option.id} className="inline-flex cursor-pointer items-center gap-2 text-sm font-medium text-blue-900">
                <input
                  type="checkbox"
                  checked={serviceBillingType === option.id}
                  onChange={() => handleBillingTypeToggle(option.id)}
                  className="h-4 w-4 rounded border-blue-300 text-blue-700 focus:ring-blue-500"
                />
                <span>{option.label}</span>
              </label>
            ))}
          </div>
          <input type="hidden" name="serviceBillingType" value={serviceBillingType} />

          {isChargeable ? (
            <label className="mt-4 block">
              <span className="mb-2 block text-sm font-medium text-blue-700">Chargeable Amount</span>
              <input
                name="chargeableAmount"
                type="number"
                min="0"
                step="0.01"
                inputMode="decimal"
                value={chargeableAmount}
                onChange={(event) => setChargeableAmount(event.target.value)}
                className="w-full rounded-2xl border border-blue-200 bg-white px-4 py-3 text-blue-950 outline-none transition placeholder:text-blue-400 focus:border-blue-400"
                placeholder="Enter amount"
                required
              />
            </label>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
