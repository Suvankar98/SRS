export function formatPerformancePoints(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "-";
  }

  return new Intl.NumberFormat("en-IN", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatPointDelta(value: number | null | undefined) {
  const formatted = formatPerformancePoints(value);

  if (formatted === "-") {
    return formatted;
  }

  return typeof value === "number" && value > 0 ? `+${formatted}` : formatted;
}