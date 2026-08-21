import fs from "fs";
import os from "os";
import path from "path";
import { PDFDocument, PDFImage, PDFFont, rgb, StandardFonts } from "pdf-lib";
import { NextResponse } from "next/server";

import { normalizeStatus } from "@/app/status-utils";
import { getSession, roleCanAssign } from "@/lib/auth";
import { formatDocketNumber } from "@/lib/docket";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

const SRTEC_BLUE = rgb(0, 0.239, 0.451);
const CUSTOMER_SIGNATURE_FILE_PREFIX = "customer-signature-";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(request: Request, context: RouteContext) {
  const session = await getSession();

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const serviceRequest = await prisma.serviceRequest.findUnique({
    where: { id },
    select: {
      docketNumber: true,
      name: true,
      company: true,
      contactPerson2: true,
      phoneNumber1: true,
      phoneNumber2: true,
      fullAddress: true,
      complaintDetails: true,
      product: true,
      status: true,
      statusReason: true,
      customerReview: true,
      assignedAt: true,
      statusSubmittedAt: true,
      closedAt: true,
      closedByName: true,
      deletedAt: true,
      deletedByName: true,
      deletedByRole: true,
      callType: true,
      area: true,
      serviceBillingType: true,
      chargeableAmount: true,
      createdAt: true,
      assignedToId: true,
      assignedTo: { select: { name: true } },
      assignments: { select: { employeeId: true } },
    },
  });

  if (!serviceRequest) {
    return NextResponse.json({ error: "Service request not found" }, { status: 404 });
  }

  const canAccessPdf =
    roleCanAssign(session.role) ||
    serviceRequest.assignedToId === session.userId ||
    serviceRequest.assignments.some((assignment) => assignment.employeeId === session.userId);

  if (!canAccessPdf) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const customerSignatureBytes = await getLatestCustomerSignatureBytes(id);
  const pdfBytes = await buildServiceRequestPdf(serviceRequest, customerSignatureBytes);
  const url = new URL(request.url);
  const dispositionType = url.searchParams.get("disposition") === "inline" ? "inline" : "attachment";

  return new NextResponse(Buffer.from(pdfBytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${dispositionType}; filename="${safeFileName(formatDocketNumber(serviceRequest.docketNumber))}-service-report.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}

async function getLatestCustomerSignatureBytes(requestId: string) {
  const uploadsBase = shouldUseTmpUploads()
    ? path.join(os.tmpdir(), "srs-uploads")
    : path.join(process.cwd(), "public", "uploads");
  const userDirs = await fs.promises.readdir(uploadsBase, { withFileTypes: true }).catch(() => []);
  const signatureFiles: Array<{ filePath: string; uploadedAt: number }> = [];

  for (const userDir of userDirs) {
    if (!userDir.isDirectory()) {
      continue;
    }

    const requestDir = path.join(uploadsBase, userDir.name, requestId);
    const files = await fs.promises.readdir(requestDir, { withFileTypes: true }).catch(() => []);

    for (const file of files) {
      const normalizedName = file.name.toLowerCase();
      if (!file.isFile() || !normalizedName.startsWith(CUSTOMER_SIGNATURE_FILE_PREFIX) || !normalizedName.endsWith(".png")) {
        continue;
      }

      const filePath = path.join(requestDir, file.name);
      const stat = await fs.promises.stat(filePath).catch(() => null);
      if (stat?.isFile()) {
        signatureFiles.push({ filePath, uploadedAt: stat.mtime.getTime() });
      }
    }
  }

  const latestSignature = signatureFiles.sort((a, b) => b.uploadedAt - a.uploadedAt)[0];
  return latestSignature ? fs.promises.readFile(latestSignature.filePath) : null;
}

async function embedSignatureImage(pdfDoc: PDFDocument, bytes: Uint8Array) {
  try {
    return await pdfDoc.embedPng(bytes);
  } catch {
    return null;
  }
}

function shouldUseTmpUploads() {
  return process.env.USE_TMP_UPLOADS === "1" || process.env.VERCEL === "1";
}

async function buildServiceRequestPdf(
  request: {
    docketNumber: string;
    name: string;
    company: string;
    contactPerson2: string | null;
    phoneNumber1: string;
    phoneNumber2: string | null;
    fullAddress: string;
    complaintDetails: string | null;
    product: string;
    status: string | null;
    statusReason: string | null;
    customerReview: string | null;
    assignedAt: Date | null;
    statusSubmittedAt: Date | null;
    closedAt: Date | null;
    closedByName: string | null;
    deletedAt: Date | null;
    deletedByName: string | null;
    deletedByRole: string | null;
    callType: string;
    area: string;
    serviceBillingType: string | null;
    chargeableAmount: number | null;
    createdAt: Date;
    assignedToId: string | null;
    assignedTo: { name: string } | null;
    assignments: Array<{ employeeId: string }>;
  },
  customerSignatureBytes: Uint8Array | null,
) {
  const pdfDoc = await PDFDocument.create();
  const regularFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const page = pdfDoc.addPage([540, 396]);
  const customerSignatureImage = customerSignatureBytes ? await embedSignatureImage(pdfDoc, customerSignatureBytes) : null;

  drawServiceReportForm(page, regularFont, boldFont, request, customerSignatureImage);

  return pdfDoc.save();
}

function drawServiceReportForm(
  page: ReturnType<PDFDocument["addPage"]>,
  regularFont: PDFFont,
  boldFont: PDFFont,
  request: {
    docketNumber: string;
    name: string;
    company: string;
    contactPerson2: string | null;
    phoneNumber1: string;
    phoneNumber2: string | null;
    fullAddress: string;
    complaintDetails: string | null;
    product: string;
    status: string | null;
    statusReason: string | null;
    customerReview: string | null;
    serviceBillingType: string | null;
    chargeableAmount: number | null;
    createdAt: Date;
    deletedAt: Date | null;
    assignedTo: { name: string } | null;
  },
  customerSignatureImage: PDFImage | null,
) {
  const x = 18;
  const top = 374;
  const width = 504;
  const rightX = 308;
  const rightWidth = x + width - rightX;
  const labelX = x + 98;
  const rightLabelX = rightX + 83;
  const statusOptionX = rightLabelX + 3;
  const bottom = 18;
  const y = {
    header: 318,
    date: 298,
    billing: 278,
    contactPerson: 258,
    contactNumber: 238,
    product: 218,
    info: 198,
    action: 158,
    partsHeader: 138,
    part1: 118,
    part2: 98,
    part3: 78,
    part4: 58,
    part5: 38,
  };
  const statusText = request.deletedAt ? "Deleted" : normalizeStatus(request.status);
  const isClosed = statusText.toLowerCase() === "completed" || statusText.toLowerCase() === "closed";
  const actionTaken = request.statusReason || (isClosed ? "Completed" : "");
  const customerReview = request.customerReview?.trim() || "-";
  const contactNumbers = [request.phoneNumber1, request.phoneNumber2].filter(Boolean).join(" / ");
  const partColumnXs = [x + 230, x + 273, x + 331, x + 399];

  drawOuterTable(page, x, top, width, top - bottom);

  [y.header, y.date, y.billing, y.contactNumber, y.info, y.action, y.partsHeader, y.part1, y.part2, y.part3, y.part4, y.part5].forEach((lineY) => {
    drawLine(page, x, lineY, x + width, lineY);
  });
  drawLine(page, x, y.contactPerson, rightX, y.contactPerson);
  drawLine(page, rightX, y.product, x + width, y.product);

  drawLine(page, rightX, top, rightX, y.info);
  drawLine(page, labelX, y.header, labelX, y.info);
  drawLine(page, rightLabelX, y.billing, rightLabelX, y.info);
  partColumnXs.slice(0, 3).forEach((columnX) => drawLine(page, columnX, y.action, columnX, bottom));
  drawLine(page, partColumnXs[3], y.action, partColumnXs[3], y.part5);

  drawCompanyHeader(page, regularFont, boldFont, x, top);
  drawCenteredText(page, "Service Report", rightX, top - 18, rightWidth, 14, boldFont);
  drawCenteredText(page, formatDocketNumber(request.docketNumber), rightX, top - 35, rightWidth, 9.2, regularFont);
  drawText(page, "Date :", rightX + 6, y.header - 16, 8.5, boldFont);
  drawText(page, formatDate(request.createdAt), rightX + 54, y.header - 16, 9.2, regularFont);
  drawCheckboxRow(page, rightX + 6, y.date - 16, regularFont, request.serviceBillingType);

  drawCellLabelValue(page, "Company Name:", request.company, x + 5, y.header - 15, labelX, rightX - 5, regularFont, boldFont, 8.3, 1);
  drawCellLabelValue(page, "Contact Person:", request.name, x + 5, y.date - 15, labelX, rightX - 5, regularFont, boldFont, 8.3, 1);
  drawCellLabelValue(page, "Contact Number:", contactNumbers || "-", x + 5, y.billing - 15, labelX, rightX - 5, regularFont, boldFont, 8.3, 1);
  drawCellLabelValue(page, "Product Name:", request.product, x + 5, y.contactPerson - 15, labelX, rightX - 5, regularFont, boldFont, 8.3, 1);
  drawCellLabelValue(page, "Address :", request.fullAddress, x + 5, y.contactNumber - 15, labelX, rightX - 5, regularFont, boldFont, 8.3, 2);

  drawCellLabelValue(page, "Call Description :", request.complaintDetails || "-", rightX + 5, y.billing - 15, rightLabelX, x + width - 5, regularFont, boldFont, 8.1, 2);
  drawCellLabelValue(page, "Technician Name :", request.assignedTo?.name || "-", rightX + 5, y.contactNumber - 15, rightLabelX, x + width - 5, regularFont, boldFont, 8.3, 1);
  drawText(page, "Call Status :", rightX + 5, y.product - 15, 8.3, boldFont);
  drawCallStatusOptions(page, statusOptionX, y.product - 16, regularFont, statusText);

  drawText(page, "Action Taken :", x + 5, y.info - 16, 8.5, regularFont);
  drawWrappedText(page, actionTaken || "-", x + 82, y.info - 16, x + width - 90, 9, regularFont, 10, 2);

  drawPartsHeader(page, x, y.action - 16, [230, 43, 58, 68, 105], regularFont, boldFont);
  drawCenteredText(page, formatAmount(request.serviceBillingType, request.chargeableAmount), x + 399, y.partsHeader - 15, 105, 8.8, regularFont);
  drawLine(page, x, bottom + 10, x + 331, bottom + 10);
  drawText(page, "Customer Review :", x + 7, bottom + 14, 7.8, regularFont);
  drawWrappedText(page, customerReview, x + 108, bottom + 14, 220, 7.8, regularFont, 8, 1);
  drawText(page, "Customer Signature :", x + 7, bottom + 3.5, 7.8, regularFont);
  if (customerSignatureImage) {
    drawContainedImage(page, customerSignatureImage, x + 118, bottom + 1, 95, 8);
  }
  drawCenteredText(page, "Total Amount", x + 331, bottom + 12, 68, 8.5, boldFont);
  drawCenteredText(page, "(Spare + Service Charge)", x + 337, bottom + 3, 68, 6.2, regularFont);
  drawText(page, "Rs.", x + 405, bottom + 12, 8.5, boldFont);
  drawText(page, formatAmount(request.serviceBillingType, request.chargeableAmount), x + 428, bottom + 12, 8.5, boldFont);
}

function drawOuterTable(page: ReturnType<PDFDocument["addPage"]>, x: number, y: number, width: number, height: number) {
  page.drawRectangle({
    x,
    y: y - height,
    width,
    height,
    borderColor: rgb(0, 0, 0),
    borderWidth: 0.8,
  });
}

function drawCompanyHeader(page: ReturnType<PDFDocument["addPage"]>, regularFont: PDFFont, boldFont: PDFFont, x: number, y: number) {
  drawText(page, "SRTEC AUTOMATION", x + 9, y - 17, 14, boldFont);
  drawText(page, "174 Bipin Ganguly Road , Dum Dum , Kolkata 700030", x + 9, y - 28, 7.8, regularFont);
  drawText(page, "Web : www.srtec.co.in ; E mail : srtec.automation@gmail.com", x + 9, y - 38, 7.8, regularFont);
  drawText(page, "Tel : 033-7964-5950  ;  M : 9073328393 / 9051017128", x + 9, y - 48, 7.8, regularFont);
}

function drawPartsHeader(
  page: ReturnType<PDFDocument["addPage"]>,
  x: number,
  y: number,
  columns: number[],
  regularFont: PDFFont,
  boldFont: PDFFont,
) {
  const headers = ["Spare Parts / Item", "QTY", "Unit Price", "Amount (Rs)", "Service Charge (Rs)"];
  let xOffset = x;

  headers.forEach((header, index) => {
    const columnWidth = columns[index];
    drawCenteredText(page, header, xOffset, y, columnWidth, 8.2, index === 0 ? boldFont : regularFont);
    xOffset += columnWidth;
  });
}

function drawCellLabelValue(
  page: ReturnType<PDFDocument["addPage"]>,
  label: string,
  value: string,
  labelLeft: number,
  baseline: number,
  valueLeft: number,
  valueRight: number,
  regularFont: PDFFont,
  boldFont: PDFFont,
  size: number,
  maxLines: number,
) {
  drawText(page, label, labelLeft, baseline, size, boldFont);
  drawWrappedText(page, value, valueLeft + 7, baseline, valueRight - valueLeft - 12, size + 0.8, regularFont, 9.8, maxLines);
}

function drawCheckboxRow(page: ReturnType<PDFDocument["addPage"]>, x: number, y: number, font: PDFFont, billingType: string | null) {
  const options = [
    ["warranty", "Warranty"],
    ["chargeable", "Chargeable"],
    ["amc", "AMC"],
  ];
  let xOffset = x;

  options.forEach(([value, label]) => {
    drawCheckbox(page, xOffset, y - 2, billingType === value);
    drawText(page, label, xOffset + 13, y, 8, font);
    xOffset += label === "Chargeable" ? 82 : 68;
  });
}

function drawCallStatusOptions(page: ReturnType<PDFDocument["addPage"]>, x: number, y: number, font: PDFFont, status: string) {
  const normalizedStatus = status.toLowerCase();
  const options = [
    { label: "In Process", checked: normalizedStatus === "in process" || normalizedStatus === "new call" || normalizedStatus === "pending" },
    { label: "Complete", checked: normalizedStatus === "completed" || normalizedStatus === "closed" },
  ];
  let xOffset = x;

  options.forEach((option) => {
    drawCheckbox(page, xOffset, y - 2, option.checked);
    drawText(page, option.label, xOffset + 13, y, 7.6, font);
    xOffset += option.label === "In Process" ? 72 : 58;
  });
}

function drawContainedImage(page: ReturnType<PDFDocument["addPage"]>, image: PDFImage, x: number, y: number, width: number, height: number) {
  const scale = Math.min(width / image.width, height / image.height);
  const imageWidth = image.width * scale;
  const imageHeight = image.height * scale;

  page.drawImage(image, {
    x: x + (width - imageWidth) / 2,
    y: y + (height - imageHeight) / 2,
    width: imageWidth,
    height: imageHeight,
  });
}

function drawCheckbox(page: ReturnType<PDFDocument["addPage"]>, x: number, y: number, checked: boolean) {
  page.drawRectangle({ x, y, width: 10, height: 10, borderColor: rgb(0, 0, 0), borderWidth: 0.7 });

  if (!checked) return;

  drawLine(page, x + 2, y + 5, x + 4.4, y + 2.3);
  drawLine(page, x + 4.4, y + 2.3, x + 8.5, y + 8);
}

function drawLine(page: ReturnType<PDFDocument["addPage"]>, x1: number, y1: number, x2: number, y2: number) {
  page.drawLine({ start: { x: x1, y: y1 }, end: { x: x2, y: y2 }, thickness: 0.7, color: rgb(0, 0, 0) });
}

function drawText(page: ReturnType<PDFDocument["addPage"]>, text: string, x: number, y: number, size: number, font: PDFFont) {
  page.drawText(toPdfText(text), { x, y, size, font, color: SRTEC_BLUE });
}

function drawCenteredText(page: ReturnType<PDFDocument["addPage"]>, text: string, x: number, y: number, width: number, size: number, font: PDFFont) {
  const safeText = toPdfText(text);
  const textWidth = font.widthOfTextAtSize(safeText, size);
  page.drawText(safeText, {
    x: x + Math.max(0, (width - textWidth) / 2),
    y,
    size,
    font,
    color: SRTEC_BLUE,
  });
}

function drawWrappedText(
  page: ReturnType<PDFDocument["addPage"]>,
  text: string,
  x: number,
  y: number,
  width: number,
  size: number,
  font: PDFFont,
  lineHeight: number,
  maxLines: number,
) {
  wrapText(text || "-", font, width, size).slice(0, maxLines).forEach((line, index) => {
    drawText(page, line, x, y - index * lineHeight, size, font);
  });
}

function wrapText(text: string, font: PDFFont, width: number, size: number) {
  const words = toPdfText(text).split(/\s+/);
  const lines: string[] = [];
  let line = "";

  words.forEach((word) => {
    const candidate = line ? `${line} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) > width && line) {
      lines.push(line);
      line = word;
      return;
    }
    line = candidate;
  });

  if (line) {
    lines.push(line);
  }

  return lines.length ? lines : ["-"];
}

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  }).format(value);
}

function formatAmount(type: string | null, amount: number | null) {
  if (type !== "chargeable") return "";
  return Math.round(amount ?? 0).toLocaleString("en-IN");
}

function toPdfText(value: string) {
  return value.replace(/[\u20B9]/g, "Rs.").replace(/[^\x20-\x7E]/g, " ");
}

function safeFileName(value: string) {
  return value.replace(/[^a-z0-9-]+/gi, "-").replace(/^-+|-+$/g, "") || "service-request";
}
