export const ATTENDANCE_IN_POINTS = {
  inBefore1045: { label: "IN Time before (10:45 AM)", points: 2 },
  inBy11: { label: "IN Time (10:45 AM to 11 AM)", points: 0 },
  missPunchOrSiteWithoutApproval: { label: "Miss Punch / Site without approval", points: -3 },
  absentWithoutApproval: { label: "Absent without approval", points: -4 },
} as const;

export const ATTENDANCE_OUT_POINTS = {
  outAfter630: { label: "OUT Time after (6:30 PM) from site location", points: 2 },
  outBefore6: { label: "OUT Time before (6:00 PM) from site location", points: 0 },
  missPunchOrOtherLocation: { label: "Miss Punch / OUT Time from other location", points: -3 },
} as const;

export const REVIEW_POINTS = {
  positiveFeedback: { label: "Positive Feedback", points: 4 },
  negativeFeedback: { label: "Negative Feedback", points: -2 },
  complaint: { label: "Complaint", points: -4 },
  na: { label: "N/A", points: 0 },
} as const;

export const DOCUMENT_SUBMISSION_POINTS = {
  submitNextDay: { label: "Bill / Challan / Service Report submit next day", points: 4 },
  submitAfterOneDay: { label: "Bill / Challan / Service Report submit after 1 day", points: 1 },
  notSubmitWithinTwoDays: { label: "Bill / Challan / Service Report not submit within 2 days", points: -4 },
  na: { label: "N/A", points: 0 },
} as const;

export const MATERIAL_HANDOVER_POINTS = {
  handoverNextDay: { label: "Material Handover next day", points: 4 },
  handoverAfterOneDay: { label: "Material Handover after 1 day", points: 1 },
  notSubmitWithinTwoDays: { label: "Material Handover not submit within 2 days", points: -4 },
  na: { label: "N/A", points: 0 },
} as const;

export type AttendanceInOption = keyof typeof ATTENDANCE_IN_POINTS;
export type AttendanceOutOption = keyof typeof ATTENDANCE_OUT_POINTS;
export type ReviewOption = keyof typeof REVIEW_POINTS;
export type DocumentSubmissionOption = keyof typeof DOCUMENT_SUBMISSION_POINTS;
export type MaterialHandoverOption = keyof typeof MATERIAL_HANDOVER_POINTS;

export function isAttendanceInOption(value: string): value is AttendanceInOption {
  return value in ATTENDANCE_IN_POINTS;
}

export function isAttendanceOutOption(value: string): value is AttendanceOutOption {
  return value in ATTENDANCE_OUT_POINTS;
}

export function isReviewOption(value: string): value is ReviewOption {
  return value in REVIEW_POINTS;
}

export function isDocumentSubmissionOption(value: string): value is DocumentSubmissionOption {
  return value in DOCUMENT_SUBMISSION_POINTS;
}

export function isMaterialHandoverOption(value: string): value is MaterialHandoverOption {
  return value in MATERIAL_HANDOVER_POINTS;
}
