import { PDFDocument, PDFFont, StandardFonts } from "pdf-lib";
import type { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";

import { normalizeStatus } from "@/app/status-utils";
import { APP_ROLES } from "@/lib/auth-constants";
import { getSession, roleCanAssign } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

type CanonicalStatus = "New Call" | "In Process" | "Completed" | "Cancel";

const STATUS_ORDER: CanonicalStatus[] = ["New Call", "In Process", "Completed", "Cancel"];
const CALL_HISTORY_EXPORT_COLUMNS = [
  { id: "docket", label: "Docket" },
  { id: "customer", label: "Customer" },
  { id: "area", label: "Area" },
  { id: "call-type", label: "Call Type" },
  { id: "amount", label: "Amount" },
  { id: "assigned-to", label: "Assigned To" },
  { id: "status", label: "Status" },
  { id: "created", label: "Created" },
] as const;

type ExportColumnId = (typeof CALL_HISTORY_EXPORT_COLUMNS)[number]["id"];
type ExportColumn = (typeof CALL_HISTORY_EXPORT_COLUMNS)[number];
type ExportRequestRow = {
  docketNumber: string;
  name: string;
  company: string;
  area: string;
  callType: string;
  serviceBillingType: string | null;
  chargeableAmount: number | null;
  status: string | null;
  createdAt: Date;
  assignedTo: { name: string } | null;
};

export async function GET(request: Request) {
  const session = await getSession();

  if (!session || !roleCanAssign(session.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const format = (url.searchParams.get("format") || "csv").toLowerCase();

  const searchQuery = (url.searchParams.get("q") || "").trim();
  const selectedStatus = getCanonicalStatus(url.searchParams.get("status") || "");
  const selectedEmployee = (url.searchParams.get("employeeId") || "").trim();
  const selectedCallType = (url.searchParams.get("callType") || "").trim();
  const selectedServiceBillingType = getServiceBillingType(url.searchParams.get("serviceBillingType") || "");
  const selectedArea = (url.searchParams.get("area") || "").trim();
  const fromDate = (url.searchParams.get("from") || "").trim();
  const toDate = (url.searchParams.get("to") || "").trim();
  const visibleColumns = getVisibleExportColumns(url.searchParams.get("columns"));
  const isChargeableServiceExport = selectedCallType === "Service" && selectedServiceBillingType === "chargeable";

  const employees = await prisma.user.findMany({
    where: { role: APP_ROLES.EMPLOYEE },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  const where: Prisma.ServiceRequestWhereInput = buildReportWhere({
    searchQuery,
    selectedStatus,
    selectedEmployee,
    selectedCallType,
    selectedServiceBillingType,
    selectedArea,
    fromDate,
    toDate,
    employees,
  });

  const requests = await prisma.serviceRequest.findMany({
    where,
    select: {
      docketNumber: true,
      name: true,
      company: true,
      area: true,
      callType: true,
      serviceBillingType: true,
      chargeableAmount: true,
      status: true,
      createdAt: true,
      assignedTo: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  if (format === "pdf") {
    const pdfBuffer = await generatePdf(requests, visibleColumns, isChargeableServiceExport);
    return new NextResponse(pdfBuffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="report-${getFileStamp()}.pdf"`,
        "Cache-Control": "no-store",
      },
    });
  }

  const csv = generateCsv(requests, visibleColumns, isChargeableServiceExport);
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="report-${getFileStamp()}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}

function generateCsv(requests: ExportRequestRow[], columns: ExportColumn[], includeChargeableTotal: boolean) {
  const header = columns.map((column) => column.label);
  const lines = [header.map(csvEscape).join(",")];

  for (const row of requests) {
    const line = columns.map((column) => getExportCellValue(row, column.id));
    lines.push(line.map(csvEscape).join(","));
  }

  if (includeChargeableTotal && columns.some((column) => column.id === "amount")) {
    const totalLine = columns.map((column, index) => {
      if (index === 0) {
        return "Total Amount";
      }

      if (column.id === "amount") {
        return formatINR(getChargeableTotal(requests));
      }

      return "";
    });
    lines.push(totalLine.map(csvEscape).join(","));
  }

  return `\uFEFF${lines.join("\n")}`;
}

function csvEscape(value: string) {
  const sanitized = value.replace(/"/g, '""');
  return `"${sanitized}"`;
}

async function generatePdf(requests: ExportRequestRow[], columns: ExportColumn[], includeChargeableTotal: boolean) {
  const pdfDoc = await PDFDocument.create();
  const regularFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const pageWidth = 595.28;
  const pageHeight = 841.89;
  const margin = 36;
  const contentWidth = pageWidth - margin * 2;

  let page = pdfDoc.addPage([pageWidth, pageHeight]);
  let y = pageHeight - margin;

  const drawLine = (text: string, size: number, isBold = false) => {
    const font = isBold ? boldFont : regularFont;
    page.drawText(text, { x: margin, y, size, font });
    y -= size + 4;
  };

  const ensureSpace = (neededHeight: number) => {
    if (y - neededHeight < margin) {
      page = pdfDoc.addPage([pageWidth, pageHeight]);
      y = pageHeight - margin;
    }
  };

  drawLine("SRS Service Report", 18, true);
  drawLine(`Generated at: ${formatDateTime(new Date())}`, 10);
  drawLine(`Total rows: ${requests.length}`, 10);
  if (includeChargeableTotal && columns.some((column) => column.id === "amount")) {
    drawLine(`Total Amount: ${formatINR(getChargeableTotal(requests))}`, 11, true);
  }
  y -= 6;

  for (const row of requests) {
    const line = columns
      .map((column) => `${column.label}: ${getExportCellValue(row, column.id)}`)
      .join(" | ");

    const wrapped = wrapTextToWidth(line, regularFont, 9, contentWidth);
    const blockHeight = wrapped.length * (9 + 4) + 3;
    ensureSpace(blockHeight);

    for (const segment of wrapped) {
      page.drawText(segment, {
        x: margin,
        y,
        size: 9,
        font: regularFont,
      });
      y -= 13;
    }

    y -= 3;
  }

  const bytes = await pdfDoc.save();
  return Buffer.from(bytes);
}

function wrapTextToWidth(
  text: string,
  font: PDFFont,
  size: number,
  maxWidth: number,
) {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    const width = font.widthOfTextAtSize(candidate, size);

    if (width <= maxWidth) {
      current = candidate;
      continue;
    }

    if (current) {
      lines.push(current);
    }

    current = word;
  }

  if (current) {
    lines.push(current);
  }

  if (lines.length === 0) {
    return [""];
  }

  return lines;
}

function getFileStamp() {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getUTCFullYear()}${pad(now.getUTCMonth() + 1)}${pad(now.getUTCDate())}-${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}`;
}

function formatDateTime(value: Date) {
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Kolkata",
  }).format(value);
}

function formatINR(value: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);
}

function buildReportWhere({
  searchQuery,
  selectedStatus,
  selectedEmployee,
  selectedCallType,
  selectedServiceBillingType,
  selectedArea,
  fromDate,
  toDate,
  employees,
}: {
  searchQuery: string;
  selectedStatus: CanonicalStatus | "";
  selectedEmployee: string;
  selectedCallType: string;
  selectedServiceBillingType: string;
  selectedArea: string;
  fromDate: string;
  toDate: string;
  employees: Array<{ id: string; name: string }>;
}): Prisma.ServiceRequestWhereInput {
  const andClauses: Prisma.ServiceRequestWhereInput[] = [];

  if (searchQuery !== "") {
    andClauses.push({
      OR: [
        { docketNumber: { contains: searchQuery, mode: "insensitive" } },
        { name: { contains: searchQuery, mode: "insensitive" } },
        { company: { contains: searchQuery, mode: "insensitive" } },
        { area: { contains: searchQuery, mode: "insensitive" } },
        { callType: { contains: searchQuery, mode: "insensitive" } },
      ],
    });
  }

  if (selectedStatus !== "") {
    andClauses.push(getStatusWhereClause(selectedStatus));
  }

  if (selectedEmployee === "unassigned") {
    andClauses.push({ assignedToId: null });
  } else if (selectedEmployee !== "" && employees.some((employee) => employee.id === selectedEmployee)) {
    andClauses.push({ assignedToId: selectedEmployee });
  }

  if (selectedCallType !== "") {
    andClauses.push({ callType: selectedCallType });
  }

  if (selectedServiceBillingType !== "") {
    andClauses.push({ serviceBillingType: selectedServiceBillingType });
  }

  if (selectedArea !== "") {
    andClauses.push({ area: selectedArea });
  }

  const createdAtFilter = getCreatedAtFilter(fromDate, toDate);
  if (createdAtFilter) {
    andClauses.push({ createdAt: createdAtFilter });
  }

  if (andClauses.length === 0) {
    return {};
  }

  return { AND: andClauses };
}

function getStatusWhereClause(status: CanonicalStatus): Prisma.ServiceRequestWhereInput {
  if (status === "New Call") {
    return {
      OR: [{ status: null }, { status: "New Call" }, { status: "Pending" }, { status: "New" }],
    };
  }

  if (status === "In Process") {
    return {
      OR: [
        { status: "In Process" },
        { status: "in process" },
        { status: "Visit & Reschedule" },
        { status: "Visit and Reschedule" },
        { status: "Reschedule" },
      ],
    };
  }

  if (status === "Completed") {
    return {
      OR: [{ status: "Completed" }, { status: "Close" }, { status: "Closed" }],
    };
  }

  return {
    OR: [{ status: "Cancel" }, { status: "Cancelled" }, { status: "Canceled" }],
  };
}

function getCreatedAtFilter(fromDate: string, toDate: string): Prisma.DateTimeFilter | undefined {
  const from = parseDateInput(fromDate, false);
  const to = parseDateInput(toDate, true);

  if (!from && !to) {
    return undefined;
  }

  return {
    gte: from || undefined,
    lte: to || undefined,
  };
}

function parseDateInput(value: string, endOfDay: boolean): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null;
  }

  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  if (endOfDay) {
    date.setUTCHours(23, 59, 59, 999);
  }

  return date;
}

function getCanonicalStatus(value: string): CanonicalStatus | "" {
  if (STATUS_ORDER.includes(value as CanonicalStatus)) {
    return value as CanonicalStatus;
  }

  return "";
}

function getVisibleExportColumns(value: string | null): ExportColumn[] {
  if (!value) {
    return [...CALL_HISTORY_EXPORT_COLUMNS];
  }

  const requestedIds = value
    .split(",")
    .map((id) => id.trim())
    .filter((id): id is ExportColumnId =>
      CALL_HISTORY_EXPORT_COLUMNS.some((column) => column.id === id),
    );

  if (requestedIds.length === 0) {
    return [...CALL_HISTORY_EXPORT_COLUMNS];
  }

  return CALL_HISTORY_EXPORT_COLUMNS.filter((column) => requestedIds.includes(column.id));
}

function getExportCellValue(row: ExportRequestRow, columnId: ExportColumnId) {
  if (columnId === "docket") return row.docketNumber;
  if (columnId === "customer") return `${row.company} / ${row.name}`;
  if (columnId === "area") return row.area;
  if (columnId === "call-type") {
    return row.serviceBillingType
      ? `${row.callType} ${row.serviceBillingType.toUpperCase()}`
      : row.callType;
  }
  if (columnId === "amount") {
    return row.serviceBillingType === "chargeable" ? formatINR(row.chargeableAmount ?? 0) : formatINR(0);
  }
  if (columnId === "assigned-to") return row.assignedTo?.name ?? "Unassigned";
  if (columnId === "status") return normalizeStatus(row.status);
  return formatDateTime(row.createdAt);
}

function getChargeableTotal(requests: ExportRequestRow[]) {
  return requests.reduce((total, request) => total + (request.chargeableAmount ?? 0), 0);
}

function getServiceBillingType(value: string) {
  const normalized = value.trim().toLowerCase();
  if (normalized === "warranty" || normalized === "amc" || normalized === "chargeable") {
    return normalized;
  }

  return "";
}
