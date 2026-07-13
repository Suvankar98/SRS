import { PDFDocument, PDFFont, StandardFonts, rgb } from "pdf-lib";
import { NextResponse } from "next/server";

import { normalizeStatus } from "@/app/status-utils";
import { getSession, roleCanAssign } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ id: string }>;
};

type PdfActivity = {
  type: string;
  title: string;
  details: string | null;
  status: string | null;
  statusReason: string | null;
  actorName: string | null;
  actorRole: string | null;
  employeeName: string | null;
  createdAt: Date;
};

export async function GET(_request: Request, context: RouteContext) {
  const session = await getSession();

  if (!session || !roleCanAssign(session.role)) {
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
      assignedTo: { select: { name: true } },
      activities: {
        orderBy: { createdAt: "asc" },
        select: {
          type: true,
          title: true,
          details: true,
          status: true,
          statusReason: true,
          actorName: true,
          actorRole: true,
          employeeName: true,
          createdAt: true,
        },
      },
    },
  });

  if (!serviceRequest) {
    return NextResponse.json({ error: "Service request not found" }, { status: 404 });
  }

  const pdfBytes = await buildServiceRequestPdf(serviceRequest);

  return new NextResponse(Buffer.from(pdfBytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${safeFileName(serviceRequest.docketNumber)}-details.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}

async function buildServiceRequestPdf(request: {
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
  assignedTo: { name: string } | null;
  activities: PdfActivity[];
}) {
  const pdfDoc = await PDFDocument.create();
  const regularFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const page = pdfDoc.addPage([595.28, 841.89]);
  const margin = 42;
  const contentWidth = 595.28 - margin * 2;
  let y = 800;

  const drawText = (text: string, options: { x?: number; size?: number; font?: PDFFont; color?: ReturnType<typeof rgb> } = {}) => {
    page.drawText(toPdfText(text), {
      x: options.x ?? margin,
      y,
      size: options.size ?? 10,
      font: options.font ?? regularFont,
      color: options.color ?? rgb(0.08, 0.16, 0.31),
    });
  };

  drawText("SRS Service Request Details", { size: 16, font: boldFont, color: rgb(0.02, 0.08, 0.22) });
  y -= 22;
  drawText(`${request.company} | ${request.docketNumber}`, { size: 12, font: boldFont, color: rgb(0.04, 0.2, 0.55) });
  y -= 18;
  drawText(`Generated: ${formatDateTime(new Date())}`, { size: 8.5, color: rgb(0.35, 0.42, 0.52) });
  y -= 22;

  const details = [
    ["Customer", request.name],
    ["Contact 2", request.contactPerson2 || "-"],
    ["Phone 1", request.phoneNumber1],
    ["Phone 2", request.phoneNumber2 || "-"],
    ["Area", request.area],
    ["Product", request.product],
    ["Call type", request.callType],
    ["Billing", formatBilling(request.serviceBillingType, request.chargeableAmount)],
    ["Assigned to", request.assignedTo?.name || "Unassigned"],
    ["Status", request.deletedAt ? "Deleted" : normalizeStatus(request.status)],
    ["Created", formatDateTime(request.createdAt)],
    ["Closed by", request.closedByName || "-"],
  ];

  details.forEach(([label, value], index) => {
    const column = index % 2;
    if (column === 0 && index > 0) {
      y -= 34;
    }
    const x = margin + column * (contentWidth / 2);
    page.drawText(label, {
      x,
      y,
      size: 7.5,
      font: boldFont,
      color: rgb(0.15, 0.32, 0.65),
    });
    page.drawText(toPdfText(value), {
      x,
      y: y - 12,
      size: 9.2,
      font: regularFont,
      color: rgb(0.08, 0.16, 0.31),
    });
  });

  y -= 54;
  drawSection("Address", request.fullAddress, page, boldFont, regularFont, margin, y, contentWidth);
  y -= 62;
  drawSection("Complaint details", request.complaintDetails || "-", page, boldFont, regularFont, margin, y, contentWidth);
  y -= 74;

  drawText("Activity Timeline", { size: 12, font: boldFont, color: rgb(0.02, 0.08, 0.22) });
  y -= 20;

  const activities = request.activities.length
    ? request.activities
    : [{
        type: "created",
        title: "Service Request Created",
        details: `Created docket ${request.docketNumber}`,
        status: request.status,
        statusReason: null,
        actorName: null,
        actorRole: null,
        employeeName: null,
        createdAt: request.createdAt,
      }];

  for (const activity of activities) {
    if (y < 80) {
      break;
    }

    page.drawCircle({ x: margin + 4, y: y - 4, size: 3.5, color: rgb(0.2, 0.45, 0.95) });
    page.drawText(toPdfText(activity.title), {
      x: margin + 18,
      y,
      size: 9.5,
      font: boldFont,
      color: rgb(0.08, 0.16, 0.31),
    });
    page.drawText(formatDateTime(activity.createdAt), {
      x: margin + 355,
      y,
      size: 8,
      font: regularFont,
      color: rgb(0.35, 0.42, 0.52),
    });
    y -= 13;
    drawWrappedText(activity.details || getActivityDetails(activity), page, regularFont, margin + 18, y, contentWidth - 18, 8.5, rgb(0.2, 0.28, 0.4));
    y -= 28;
  }

  return pdfDoc.save();
}

function drawSection(title: string, value: string, page: ReturnType<PDFDocument["addPage"]>, boldFont: PDFFont, regularFont: PDFFont, x: number, y: number, width: number) {
  page.drawText(title, { x, y, size: 8, font: boldFont, color: rgb(0.15, 0.32, 0.65) });
  drawWrappedText(value, page, regularFont, x, y - 14, width, 9, rgb(0.08, 0.16, 0.31));
}

function drawWrappedText(text: string, page: ReturnType<PDFDocument["addPage"]>, font: PDFFont, x: number, y: number, width: number, size: number, color: ReturnType<typeof rgb>) {
  const words = toPdfText(text).split(/\s+/);
  let line = "";
  let offset = 0;

  words.forEach((word) => {
    const candidate = line ? `${line} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) > width && line) {
      page.drawText(line, { x, y: y - offset, size, font, color });
      line = word;
      offset += size + 4;
      return;
    }
    line = candidate;
  });

  if (line) {
    page.drawText(line, { x, y: y - offset, size, font, color });
  }
}

function getActivityDetails(activity: PdfActivity) {
  if (activity.statusReason) {
    return `${activity.status || "Status"}: ${activity.statusReason}`;
  }

  if (activity.employeeName) {
    return `Employee: ${activity.employeeName}`;
  }

  return activity.status ? `Status: ${activity.status}` : "Activity recorded";
}

function formatBilling(type: string | null, amount: number | null) {
  if (type === "chargeable") {
    return `Chargeable - Rs. ${Math.round(amount ?? 0).toLocaleString("en-IN")}`;
  }

  if (type === "amc") return "AMC";
  if (type === "warranty") return "Warranty";
  return "-";
}

function formatDateTime(value: Date) {
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Kolkata",
  }).format(value);
}

function toPdfText(value: string) {
  return value.replace(/[₹]/g, "Rs.").replace(/[^\x20-\x7E]/g, " ");
}

function safeFileName(value: string) {
  return value.replace(/[^a-z0-9-]+/gi, "-").replace(/^-+|-+$/g, "") || "service-request";
}
