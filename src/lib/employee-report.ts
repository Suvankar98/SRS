import {
  ATTENDANCE_IN_POINTS,
  ATTENDANCE_OUT_POINTS,
} from "@/lib/employee-performance-rules";

export type EmployeeReportRequest = {
  id: string;
  docketNumber: string;
  name: string;
  company: string;
  area: string;
  status: string | null;
  statusReason: string | null;
  statusPointsDelta: number | null;
  createdAt: Date;
  assignedAt?: Date | string | null;
  statusSubmittedAt?: Date | string | null;
  lastAttemptAt?: Date | string | null;
  closedAt?: Date | string | null;
};

export type EmployeeReportPointAdjustment = {
  id: string;
  attendanceOption: string;
  attendancePoints: number;
  reviewOption: string;
  reviewPoints: number;
  documentSubmissionOption: string;
  documentSubmissionPoints: number;
  materialHandoverOption: string;
  materialHandoverPoints: number;
  createdAt: Date;
};

export type EmployeeReportPointCell = {
  label: string;
  points: number | null;
};

export type EmployeeReportCompanyDocket = {
  companyName: string;
  docketNumber: string;
};

export type EmployeeReportRow = {
  id: string;
  companyDockets: EmployeeReportCompanyDocket[];
  date: Date;
  workSubmission: EmployeeReportPointCell;
  attendanceIn: EmployeeReportPointCell;
  attendanceOut: EmployeeReportPointCell;
  review: EmployeeReportPointCell;
  documentSubmission: EmployeeReportPointCell;
  materialHandover: EmployeeReportPointCell;
};

export function buildEmployeeReportRows({
  activeRequests,
  reportRequests,
  pointAdjustments,
  limit = 20,
}: {
  activeRequests: EmployeeReportRequest[];
  reportRequests: EmployeeReportRequest[];
  pointAdjustments: EmployeeReportPointAdjustment[];
  limit?: number | null;
}) {
  const rows = new Map<string, EmployeeReportRow>();
  const countedRequestIds = new Set<string>();

  for (const request of [...activeRequests, ...reportRequests]) {
    if (countedRequestIds.has(request.id)) {
      continue;
    }

    const reportDate = getEmployeeReportDate(request);

    if (!reportDate) {
      continue;
    }

    const row = getOrCreateEmployeeReportRow(rows, reportDate);
    addCompanyDocketToEmployeeReportRow(row, request);

    if (typeof request.statusPointsDelta === "number") {
      addEmployeeReportPoints(row.workSubmission, request.statusPointsDelta);
    }

    countedRequestIds.add(request.id);
  }

  for (const adjustment of pointAdjustments) {
    const row = getOrCreateEmployeeReportRow(rows, adjustment.createdAt);
    const attendancePoints = getEmployeeReportAttendancePoints(adjustment);
    addEmployeeReportPoints(row.attendanceIn, attendancePoints.inPoints);
    addEmployeeReportPoints(row.attendanceOut, attendancePoints.outPoints);
    addEmployeeReportPoints(row.review, adjustment.reviewPoints);
    addEmployeeReportPoints(row.documentSubmission, adjustment.documentSubmissionPoints);
    addEmployeeReportPoints(row.materialHandover, adjustment.materialHandoverPoints);
  }

  const sortedRows = Array.from(rows.values()).sort((a, b) => getNullableDateTime(b.date) - getNullableDateTime(a.date));
  const visibleRows = typeof limit === "number" ? sortedRows.slice(0, limit) : sortedRows;

  return {
    rows: visibleRows,
    totalPoints: calculateEmployeeReportTotal(visibleRows),
  };
}

function getOrCreateEmployeeReportRow(rows: Map<string, EmployeeReportRow>, date: Date) {
  const dateKey = getEmployeeReportDateKey(date);
  const existingRow = rows.get(dateKey);

  if (existingRow) {
    return existingRow;
  }

  const row: EmployeeReportRow = {
    id: dateKey,
    companyDockets: [],
    date,
    workSubmission: emptyEmployeeReportPointCell(),
    attendanceIn: emptyEmployeeReportPointCell(),
    attendanceOut: emptyEmployeeReportPointCell(),
    review: emptyEmployeeReportPointCell(),
    documentSubmission: emptyEmployeeReportPointCell(),
    materialHandover: emptyEmployeeReportPointCell(),
  };

  rows.set(dateKey, row);
  return row;
}

function addCompanyDocketToEmployeeReportRow(row: EmployeeReportRow, request: EmployeeReportRequest) {
  const exists = row.companyDockets.some((entry) => entry.docketNumber === request.docketNumber);

  if (!exists) {
    row.companyDockets.push({
      companyName: request.company,
      docketNumber: request.docketNumber,
    });
  }
}

function addEmployeeReportPoints(cell: EmployeeReportPointCell, points: number) {
  cell.points = (cell.points ?? 0) + points;
}

function getEmployeeReportAttendancePoints(adjustment: EmployeeReportPointAdjustment) {
  try {
    const parsed = JSON.parse(adjustment.attendanceOption) as { inOption?: unknown; outOption?: unknown };
    const inOption = typeof parsed.inOption === "string" ? parsed.inOption : "";
    const outOption = typeof parsed.outOption === "string" ? parsed.outOption : "";

    return {
      inPoints: getAttendanceInPoints(inOption),
      outPoints: getAttendanceOutPoints(outOption),
    };
  } catch {
    return {
      inPoints: adjustment.attendancePoints,
      outPoints: 0,
    };
  }
}

function getAttendanceInPoints(value: string) {
  if (value in ATTENDANCE_IN_POINTS) {
    return ATTENDANCE_IN_POINTS[value as keyof typeof ATTENDANCE_IN_POINTS].points;
  }

  return 0;
}

function getAttendanceOutPoints(value: string) {
  if (value in ATTENDANCE_OUT_POINTS) {
    return ATTENDANCE_OUT_POINTS[value as keyof typeof ATTENDANCE_OUT_POINTS].points;
  }

  return 0;
}

function calculateEmployeeReportTotal(rows: EmployeeReportRow[]) {
  return rows.reduce(
    (total, row) =>
      total +
      (row.workSubmission.points ?? 0) +
      (row.attendanceIn.points ?? 0) +
      (row.attendanceOut.points ?? 0) +
      (row.review.points ?? 0) +
      (row.documentSubmission.points ?? 0) +
      (row.materialHandover.points ?? 0),
    0,
  );
}

function emptyEmployeeReportPointCell(): EmployeeReportPointCell {
  return { label: "-", points: null };
}

function getEmployeeReportDate(request: EmployeeReportRequest) {
  return (
    getDateValue(request.lastAttemptAt) ??
    getDateValue(request.statusSubmittedAt) ??
    getDateValue(request.closedAt) ??
    getDateValue(request.assignedAt) ??
    getDateValue(request.createdAt)
  );
}

function getDateValue(value: Date | string | null | undefined) {
  if (!value) {
    return null;
  }

  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function getNullableDateTime(value: Date | null) {
  return value ? value.getTime() : 0;
}

function getEmployeeReportDateKey(value: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(value);
}
