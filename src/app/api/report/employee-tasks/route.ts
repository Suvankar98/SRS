import { NextResponse } from "next/server";

import { getSession, roleCanAssign } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const session = await getSession();
  if (!session || !roleCanAssign(session.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const employeeId = url.searchParams.get("employeeId")?.trim() ?? "";
  const date = url.searchParams.get("date")?.trim() ?? "";

  if (!employeeId || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: "Invalid employee or date" }, { status: 400 });
  }

  const startAt = new Date(`${date}T00:00:00.000+05:30`);
  const endAt = new Date(startAt.getTime() + 24 * 60 * 60 * 1000);

  const assignments = await prisma.serviceAssignment.findMany({
    where: {
      employeeId,
      assignedAt: { lt: endAt },
      request: { deletedAt: null },
    },
    orderBy: { assignedAt: "desc" },
    select: {
      id: true,
      requestId: true,
      assignedAt: true,
      request: {
        select: {
          docketNumber: true,
          company: true,
          name: true,
        },
      },
    },
  });

  return NextResponse.json({
    tasks: assignments.map((assignment) => ({
      id: assignment.id,
      requestId: assignment.requestId,
      docketNumber: assignment.request.docketNumber,
      company: assignment.request.company,
      name: assignment.request.name,
      assignedAt: assignment.assignedAt.toISOString(),
    })),
  });
}
