/**
 * Get the CSS class for a status pill based on the status value
 */
export function getStatusPillClass(status?: string | null): string {
  switch (status) {
    case "Cancel":
      return "bg-red-100 text-red-800 ring-red-300";
    case "In Process":
      return "bg-yellow-100 text-yellow-800 ring-yellow-300";
    case "Completed":
      return "bg-green-100 text-green-800 ring-green-300";
    case "New Call":
    default:
      return "bg-blue-100 text-blue-800 ring-blue-300";
  }
}

export function getStatusLabel(status?: string | null): string {
  if (!status || status === "New Call") {
    return "New Call";
  }

  if (status === "Completed") {
    return "Completed";
  }

  return status;
}

export function formatServiceBillingType(value: string) {
  if (value === "amc") {
    return "AMC";
  }

  if (value === "chargeable") {
    return "Chargeable";
  }

  return value;
}

export function formatINRCurrency(amount: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}

