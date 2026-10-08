import { NextResponse } from "next/server";

import { getSession, roleCanAssign } from "@/lib/auth";
import { APP_ROLES } from "@/lib/auth-constants";
import { prisma } from "@/lib/prisma";
import { ensureSalarySlipTable } from "@/lib/salary-slips";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ id: string }>;
};

type SalarySlipFileRow = {
  employeeId: string;
  fileName: string;
  mimeType: string;
  fileData: Buffer;
};

export async function GET(_request: Request, context: RouteContext) {
  const session = await getSession();

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;

  if (!/^[0-9a-fA-F-]{36}$/.test(id)) {
    return NextResponse.json({ error: "Invalid salary slip" }, { status: 400 });
  }

  await ensureSalarySlipTable();
  const [salarySlip] = await prisma.$queryRaw<SalarySlipFileRow[]>`
    SELECT "employeeId", "fileName", "mimeType", "fileData"
    FROM "SalarySlip"
    WHERE "id" = ${id}::uuid
    LIMIT 1
  `;

  if (!salarySlip) {
    return NextResponse.json({ error: "Salary slip not found" }, { status: 404 });
  }

  const canRead = roleCanAssign(session.role) ||
    (session.role === APP_ROLES.EMPLOYEE && salarySlip.employeeId === session.userId);

  if (!canRead) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const fileBytes = new Uint8Array(salarySlip.fileData);
  const responseBody = fileBytes.buffer.slice(
    fileBytes.byteOffset,
    fileBytes.byteOffset + fileBytes.byteLength,
  ) as ArrayBuffer;

  return new NextResponse(responseBody, {
    headers: {
      "Cache-Control": "private, no-store",
      "Content-Disposition": `inline; filename="${safeHeaderFileName(salarySlip.fileName)}"`,
      "Content-Length": String(salarySlip.fileData.byteLength),
      "Content-Type": salarySlip.mimeType,
      "X-Content-Type-Options": "nosniff",
    },
  });
}

function safeHeaderFileName(value: string) {
  return value.replace(/[^\x20-\x7E]|["\\]/g, "_");
}
