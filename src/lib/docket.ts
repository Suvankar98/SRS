export function formatDocketNumber(value: string | null | undefined) {
  const docketNumber = value?.trim() ?? "";

  if (docketNumber === "") {
    return "";
  }

  return docketNumber.replace(/^srs-/i, "SRS-");
}
