import { randomUUID } from "crypto";
import { NextResponse } from "next/server";

import { getSession, roleCanAssign } from "@/lib/auth";
import { APP_ROLES } from "@/lib/auth-constants";
import { prisma } from "@/lib/prisma";
import {
  ensureSalarySlipTable,
  isSalarySlipMimeType,
  isValidSalarySlipMonth,
  isValidSalarySlipYear,
  SALARY_SLIP_MAX_FILE_SIZE,
  SALARY_SLIP_MAX_FILES_PER_UPLOAD,
  type SalarySlipMetadataRow,
} from "@/lib/salary-slips";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  const session = await getSession();

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const requestedEmployeeId = url.searchParams.get("employeeId")?.trim() ?? "";
  const year = Number(url.searchParams.get("year"));
  const employeeId = session.role === APP_ROLES.EMPLOYEE ? session.userId : requestedEmployeeId;

  if (!isUuid(employeeId) || !isValidSalarySlipYear(year)) {
    return NextResponse.json({ error: "Invalid employee or year" }, { status: 400 });
  }

  if (session.role === APP_ROLES.EMPLOYEE && requestedEmployeeId && requestedEmployeeId !== session.userId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const employee = await prisma.user.findFirst({
    where: { id: employeeId, role: APP_ROLES.EMPLOYEE },
    select: { id: true },
  });

  if (!employee) {
    return NextResponse.json({ error: "Employee not found" }, { status: 404 });
  }

  await ensureSalarySlipTable();
  const rows = await prisma.$queryRaw<SalarySlipMetadataRow[]>`
    SELECT
      "id",
      "employeeId",
      "year",
      "month",
      "fileName",
      "mimeType",
      OCTET_LENGTH("fileData")::INTEGER AS "fileSize",
      "uploadedByName",
      "uploadedAt"
    FROM "SalarySlip"
    WHERE "employeeId" = ${employeeId}::uuid AND "year" = ${year}
    ORDER BY "month" ASC, "uploadedAt" DESC
  `;

  return NextResponse.json({
    slips: rows.map((row) => ({
      ...row,
      uploadedAt: row.uploadedAt.toISOString(),
      url: `/api/salary-slips/${row.id}`,
    })),
  });
}

export async function POST(request: Request) {
  const session = await getSession();

  if (!session || !roleCanAssign(session.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await request.formData();
  const employeeId = getString(formData, "employeeId");
  const year = Number(getString(formData, "year"));
  const month = Number(getString(formData, "month"));
  const files = formData.getAll("files").filter((value): value is File => value instanceof File && value.size > 0);

  if (!isUuid(employeeId) || !isValidSalarySlipYear(year) || !isValidSalarySlipMonth(month)) {
    return NextResponse.json({ error: "Invalid salary slip details" }, { status: 400 });
  }

  if (files.length === 0) {
    return NextResponse.json({ error: "Choose one or more PNG or PDF files" }, { status: 400 });
  }

  if (files.length > SALARY_SLIP_MAX_FILES_PER_UPLOAD) {
    return NextResponse.json({ error: `Upload up to ${SALARY_SLIP_MAX_FILES_PER_UPLOAD} files at a time` }, { status: 400 });
  }

  if (files.some((file) => !isSalarySlipMimeType(file.type))) {
    return NextResponse.json({ error: "Only PNG and PDF files are allowed" }, { status: 400 });
  }

  if (files.some((file) => file.size > SALARY_SLIP_MAX_FILE_SIZE)) {
    return NextResponse.json({ error: "Each salary-slip file must be 10 MB or smaller" }, { status: 400 });
  }

  const [employee, actor] = await Promise.all([
    prisma.user.findFirst({
      where: { id: employeeId, role: APP_ROLES.EMPLOYEE },
      select: { id: true },
    }),
    prisma.user.findUnique({
      where: { id: session.userId },
      select: { name: true },
    }),
  ]);

  if (!employee) {
    return NextResponse.json({ error: "Employee not found" }, { status: 404 });
  }

  const fileRecords = await Promise.all(
    files.map(async (file) => ({
      id: randomUUID(),
      fileName: file.name,
      mimeType: file.type,
      fileData: Buffer.from(await file.arrayBuffer()),
    })),
  );
  const uploadedAt = new Date();
  await ensureSalarySlipTable();
  await prisma.$transaction(async (transaction) => {
    for (const fileRecord of fileRecords) {
      await transaction.$executeRaw`
        INSERT INTO "SalarySlip" (
          "id", "employeeId", "year", "month", "fileName", "mimeType", "fileData",
          "uploadedById", "uploadedByName", "uploadedAt"
        ) VALUES (
          ${fileRecord.id}::uuid, ${employeeId}::uuid, ${year}, ${month}, ${fileRecord.fileName},
          ${fileRecord.mimeType}, ${fileRecord.fileData}, ${session.userId}::uuid,
          ${actor?.name ?? "Admin / Manager"}, ${uploadedAt}
        )
      `;
    }
  });

  return NextResponse.json({
    ok: true,
    count: fileRecords.length,
    message: `${fileRecords.length} salary-slip ${fileRecords.length === 1 ? "file" : "files"} uploaded successfully.`,
  });
}

function getString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function isUuid(value: string) {
  return /^[0-9a-fA-F-]{36}$/.test(value);
}
