import { PDFDocument, PDFFont, StandardFonts, rgb } from "pdf-lib";
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
  { id: "customer", label: "Company" },
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

  const pageWidth = 841.89;
  const pageHeight = 595.28;
  const margin = 28;
  const contentWidth = pageWidth - margin * 2;
  const headerFontSize = 7.4;
  const bodyFontSize = 7.2;
  const lineHeight = 9.6;
  const cellPadding = 4.5;
  const tableHeaderHeight = 22;
  const tableColumns = getPdfTableColumns(columns, contentWidth);

  let page = pdfDoc.addPage([pageWidth, pageHeight]);
  let y = pageHeight - margin;

  const drawDocumentHeader = () => {
    page.drawText("SRS Service Report", {
      x: margin,
      y,
      size: 18,
      font: boldFont,
      color: rgb(0.02, 0.08, 0.22),
    });

    page.drawText(`Generated: ${formatDateTime(new Date())}`, {
      x: margin,
      y: y - 18,
      size: 8.4,
      font: regularFont,
      color: rgb(0.25, 0.32, 0.45),
    });

    page.drawText(`Rows: ${requests.length}`, {
      x: margin + 180,
      y: y - 18,
      size: 8.4,
      font: regularFont,
      color: rgb(0.25, 0.32, 0.45),
    });

    if (includeChargeableTotal && columns.some((column) => column.id === "amount")) {
      page.drawText(`Total Amount: ${formatINRPlain(getChargeableTotal(requests))}`, {
        x: margin + 250,
        y: y - 18,
        size: 8.4,
        font: boldFont,
        color: rgb(0.02, 0.08, 0.22),
      });
    }

    y -= 40;
  };

  const drawTableHeader = () => {
    page.drawRectangle({
      x: margin,
      y: y - tableHeaderHeight,
      width: contentWidth,
      height: tableHeaderHeight,
      color: rgb(0.9, 0.95, 1),
      borderColor: rgb(0.63, 0.78, 1),
      borderWidth: 0.8,
    });

    let x = margin;
    for (const column of tableColumns) {
      page.drawText(toPdfText(column.label.toUpperCase()), {
        x: x + cellPadding,
        y: y - 14,
        size: headerFontSize,
        font: boldFont,
        color: rgb(0.02, 0.22, 0.68),
      });
      x += column.width;
      page.drawLine({
        start: { x, y },
        end: { x, y: y - tableHeaderHeight },
        thickness: 0.5,
        color: rgb(0.75, 0.84, 0.96),
      });
    }

    y -= tableHeaderHeight;
  };

  const addPageWithTableHeader = () => {
    page = pdfDoc.addPage([pageWidth, pageHeight]);
    y = pageHeight - margin;
    drawTableHeader();
  };

  drawDocumentHeader();
  drawTableHeader();

  if (requests.length === 0) {
    drawPdfTableRow(["No records found."], [contentWidth], {
      page,
      x: margin,
      y,
      regularFont,
      bodyFontSize,
      lineHeight,
      cellPadding,
    });
  }

  for (const [index, row] of requests.entries()) {
    const cellLines = tableColumns.map((column) =>
      wrapTextToWidth(getPdfCellValue(row, column.id), regularFont, bodyFontSize, column.width - cellPadding * 2),
    );
    const rowHeight = Math.max(24, Math.max(...cellLines.map((lines) => lines.length)) * lineHeight + cellPadding * 2);

    if (y - rowHeight < margin) {
      addPageWithTableHeader();
    }

    page.drawRectangle({
      x: margin,
      y: y - rowHeight,
      width: contentWidth,
      height: rowHeight,
      color: index % 2 === 0 ? rgb(1, 1, 1) : rgb(0.97, 0.99, 1),
      borderColor: rgb(0.78, 0.86, 0.96),
      borderWidth: 0.5,
    });

    let x = margin;
    for (const [cellIndex, column] of tableColumns.entries()) {
      for (const [lineIndex, line] of cellLines[cellIndex].entries()) {
        page.drawText(line, {
          x: x + cellPadding,
          y: y - cellPadding - bodyFontSize - lineIndex * lineHeight,
          size: bodyFontSize,
          font: regularFont,
          color: rgb(0.02, 0.08, 0.22),
        });
      }
      x += column.width;
      page.drawLine({
        start: { x, y },
        end: { x, y: y - rowHeight },
        thickness: 0.4,
        color: rgb(0.84, 0.9, 0.98),
      });
    }

    y -= rowHeight;
  }

  const bytes = await pdfDoc.save();
  return Buffer.from(bytes);
}

function drawPdfTableRow(
  values: string[],
  widths: number[],
  options: {
    page: ReturnType<PDFDocument["addPage"]>;
    x: number;
    y: number;
    regularFont: PDFFont;
    bodyFontSize: number;
    lineHeight: number;
    cellPadding: number;
  },
) {
  const rowHeight = 24;
  options.page.drawRectangle({
    x: options.x,
    y: options.y - rowHeight,
    width: widths.reduce((total, width) => total + width, 0),
    height: rowHeight,
    color: rgb(1, 1, 1),
    borderColor: rgb(0.78, 0.86, 0.96),
    borderWidth: 0.5,
  });
  options.page.drawText(toPdfText(values.join(" ")), {
    x: options.x + options.cellPadding,
    y: options.y - options.cellPadding - options.bodyFontSize,
    size: options.bodyFontSize,
    font: options.regularFont,
    color: rgb(0.02, 0.08, 0.22),
  });
}

function getPdfTableColumns(columns: ExportColumn[], contentWidth: number) {
  const weights: Record<ExportColumnId, number> = {
    docket: 0.85,
    customer: 2.05,
    area: 1,
    "call-type": 1.25,
    amount: 0.9,
    "assigned-to": 1.1,
    status: 0.95,
    created: 1.35,
  };
  const totalWeight = columns.reduce((total, column) => total + weights[column.id], 0);

  return columns.map((column) => ({
    ...column,
    width: (contentWidth * weights[column.id]) / totalWeight,
  }));
}

function getPdfCellValue(row: ExportRequestRow, columnId: ExportColumnId) {
  if (columnId === "customer") {
    return `${row.company}\n${row.name}`;
  }

  if (columnId === "call-type" && row.serviceBillingType) {
    return `${row.callType}\n${row.serviceBillingType.toUpperCase()}`;
  }

  return getExportCellValue(row, columnId, "pdf");
}

function wrapTextToWidth(
  text: string,
  font: PDFFont,
  size: number,
  maxWidth: number,
) {
  const paragraphs = toPdfText(text).split(/\r?\n/);
  const lines: string[] = [];

  for (const paragraph of paragraphs) {
    const words = paragraph.split(/\s+/).filter(Boolean);
    let current = "";

    for (const word of words) {
      const chunks = splitLongWord(word, font, size, maxWidth);

      for (const chunk of chunks) {
        const candidate = current ? `${current} ${chunk}` : chunk;
        const width = font.widthOfTextAtSize(candidate, size);

        if (width <= maxWidth) {
          current = candidate;
          continue;
        }

        if (current) {
          lines.push(current);
        }

        current = chunk;
      }
    }

    if (current) {
      lines.push(current);
    }
  }

  if (lines.length === 0) {
    return [""];
  }

  return lines;
}

function splitLongWord(word: string, font: PDFFont, size: number, maxWidth: number) {
  if (font.widthOfTextAtSize(word, size) <= maxWidth) {
    return [word];
  }

  const chunks: string[] = [];
  let current = "";

  for (const char of word) {
    const candidate = `${current}${char}`;
    if (current && font.widthOfTextAtSize(candidate, size) > maxWidth) {
      chunks.push(current);
      current = char;
      continue;
    }

    current = candidate;
  }

  if (current) {
    chunks.push(current);
  }

  return chunks;
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

function formatINRPlain(value: number) {
  return `Rs. ${new Intl.NumberFormat("en-IN", {
    maximumFractionDigits: 0,
  }).format(value)}`;
}

function toPdfText(value: string) {
  return value.replace(/[^\x20-\x7E]/g, " ");
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

function getExportCellValue(row: ExportRequestRow, columnId: ExportColumnId, target: "csv" | "pdf" = "csv") {
  if (columnId === "docket") return row.docketNumber;
  if (columnId === "customer") return `${row.company} / ${row.name}`;
  if (columnId === "area") return row.area;
  if (columnId === "call-type") {
    return row.serviceBillingType
      ? `${row.callType} ${row.serviceBillingType.toUpperCase()}`
      : row.callType;
  }
  if (columnId === "amount") {
    const amount = row.serviceBillingType === "chargeable" ? row.chargeableAmount ?? 0 : 0;
    return target === "pdf" ? formatINRPlain(amount) : formatINR(amount);
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
