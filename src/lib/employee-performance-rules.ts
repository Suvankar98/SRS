export const ATTENDANCE_POINTS = {
  presentBy1045: { label: "Present within 10:45 AM", points: 1 },
  absentWithoutInform: { label: "Absent without inform", points: -5 },
} as const;

export const REVIEW_POINTS = {
  star5: { label: "5 star", points: 3 },
  star4: { label: "4 star", points: 1 },
  star2: { label: "2 star", points: -2 },
  noReview: { label: "No review", points: 0 },
} as const;

export const DOCUMENT_SUBMISSION_POINTS = {
  submittedWithin24h: { label: "Submitted within 24 hr", points: 2 },
  notSubmittedWithin24h: { label: "Not submitted within 24 hr", points: -3 },
  na: { label: "N/A", points: 0 },
} as const;

export const MATERIAL_HANDOVER_POINTS = {
  withInformation: { label: "Handover with information", points: 2 },
  withoutInformation: { label: "Handover without information", points: -3 },
  na: { label: "N/A", points: 0 },
} as const;

export const TEAMWORK_POINTS = {
  helpingOtherEngineer: { label: "Helping other engineer", points: 3 },
  refuseToHelp: { label: "Refuse to help", points: -5 },
} as const;

export type AttendanceOption = keyof typeof ATTENDANCE_POINTS;
export type ReviewOption = keyof typeof REVIEW_POINTS;
export type DocumentSubmissionOption = keyof typeof DOCUMENT_SUBMISSION_POINTS;
export type MaterialHandoverOption = keyof typeof MATERIAL_HANDOVER_POINTS;
export type TeamworkOption = keyof typeof TEAMWORK_POINTS;

export function isAttendanceOption(value: string): value is AttendanceOption {
  return value in ATTENDANCE_POINTS;
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

export function isTeamworkOption(value: string): value is TeamworkOption {
  return value in TEAMWORK_POINTS;
}
