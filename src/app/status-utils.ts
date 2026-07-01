/**
 * Get the CSS class for a status pill based on the status value
 */
export function getStatusPillClass(status?: string | null): string {
  switch (normalizeStatus(status)) {
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
  return normalizeStatus(status);
}

export function normalizeStatus(status?: string | null): "New Call" | "In Process" | "Completed" | "Cancel" {
  const normalized = (status || "").trim().toLowerCase();

  if (normalized === "" || normalized === "new call" || normalized === "pending" || normalized === "new") {
    return "New Call";
  }

  if (
    normalized === "in process" ||
    normalized === "in-process" ||
    normalized === "visit & reschedule" ||
    normalized === "visit and reschedule" ||
    normalized === "reschedule"
  ) {
    return "In Process";
  }

  if (normalized === "completed" || normalized === "close" || normalized === "closed") {
    return "Completed";
  }

  if (normalized === "cancel" || normalized === "cancelled" || normalized === "canceled") {
    return "Cancel";
  }

  return "New Call";
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

