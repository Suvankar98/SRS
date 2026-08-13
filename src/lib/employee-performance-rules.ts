export const ATTENDANCE_IN_POINTS = {
  inBefore1045: { label: "IN Time before (10:45 AM)", points: 2 },
  inBy11: { label: "IN Time (10:45 AM to 11 AM)", points: 0 },
  inAfter11: { label: "IN Time after 11.00 AM", points: -2 },
  missPunchOrSiteWithoutApproval: { label: "Miss Punch / IN Punch Other location", points: -3 },
  absentWithoutApproval: { label: "Absent without approval", points: -4 },
} as const;

export const ATTENDANCE_OUT_POINTS = {
  outAfter630: { label: "OUT Time after (6:30 PM to 7 PM) from site location", points: 2 },
  outBefore6: { label: "OUT Time before (6:30 PM) from site location", points: 0 },
  missPunchOrOtherLocation: { label: "Miss Punch / OUT Punch from other location", points: -3 },
} as const;

export const REVIEW_POINTS = {
  positiveFeedback: { label: "Positive Feedback from client / Service Manager", points: 4 },
  negativeFeedback: { label: "Negative Feedback from client / Service Manager", points: -2 },
  complaint: { label: "Complaint from client / Service Manager", points: -4 },
} as const;

export const DOCUMENT_SUBMISSION_POINTS = {
  submitNextDay: { label: "Bill / Challan / Service Report submit next day", points: 0 },
  notSubmitNextDay: { label: "Bill / Challan / Service Report not submit next day", points: -4 },
} as const;

export const MATERIAL_HANDOVER_POINTS = {
  handoverNextDay: { label: "Material Handover next day", points: 0 },
  notHandoverNextDay: { label: "Material Handover not submit next day", points: -4 },
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

export function getDocumentSubmissionPoints(value: string, fallbackPoints = 0) {
  if (value in DOCUMENT_SUBMISSION_POINTS) {
    return DOCUMENT_SUBMISSION_POINTS[value as DocumentSubmissionOption].points;
  }

  if (value === "submitAfterOneDay" || value === "notSubmitWithinTwoDays") {
    return -4;
  }

  return fallbackPoints;
}

export function getMaterialHandoverPoints(value: string, fallbackPoints = 0) {
  if (value in MATERIAL_HANDOVER_POINTS) {
    return MATERIAL_HANDOVER_POINTS[value as MaterialHandoverOption].points;
  }

  if (value === "handoverAfterOneDay" || value === "notSubmitWithinTwoDays") {
    return -4;
  }

  return fallbackPoints;
}