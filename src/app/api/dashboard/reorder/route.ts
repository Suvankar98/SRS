import { NextResponse } from "next/server";

import { getSession, roleCanAssign } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function getRequestIds(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((entry): entry is string => typeof entry === "string")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

export async function POST(request: Request) {
  const session = await getSession();

  if (!session || !roleCanAssign(session.role)) {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const requestIds = getRequestIds(body.requestIds);

    if (requestIds.length === 0) {
      return NextResponse.json({ success: false, message: "No requests supplied" }, { status: 400 });
    }

    await prisma.$transaction(
      requestIds.map((requestId, index) =>
        prisma.serviceRequest.update({
          where: { id: requestId },
          data: { dashboardOrder: index + 1 },
        }),
      ),
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Dashboard reorder failed", error);
    return NextResponse.json({ success: false, message: "Server error" }, { status: 500 });
  }
}
