export const DAILY_REPORTING_POINTS = { onTime: 10, late: 6, missing: -4 } as const;

export function getReportingDateKey(date: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(date);
}

export function getDailyReportingSubmissionPoints(assignedAt: Date, submittedAt: Date, callCount: number) {
  if (getReportingDateKey(assignedAt) !== getReportingDateKey(submittedAt)) {
    return DAILY_REPORTING_POINTS.missing / Math.max(1, callCount);
  }
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(submittedAt);
  const minutes = Number(parts.find((part) => part.type === "hour")?.value) * 60
    + Number(parts.find((part) => part.type === "minute")?.value);
  return (minutes <= 21 * 60 ? DAILY_REPORTING_POINTS.onTime : DAILY_REPORTING_POINTS.late)
    / Math.max(1, callCount);
}
