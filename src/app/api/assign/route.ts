import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession, roleCanAssign } from "@/lib/auth";
import { normalizeStatus } from "@/app/status-utils";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { requestId, assignedToId } = body;

    const session = await getSession();
    if (!session || !roleCanAssign(session.role)) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 403 });
    }

    const serviceRequest = await prisma.serviceRequest.findUnique({
      where: { id: String(requestId) },
      select: { status: true },
    });

    if (!serviceRequest) {
      return NextResponse.json({ success: false, message: "Service request not found" }, { status: 404 });
    }

    const isCompletedRequest = normalizeStatus(serviceRequest.status) === "Completed";
    if (isCompletedRequest && !roleCanAssign(session.role)) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 403 });
    }

    // Basic update: set assignedToId and assignedAt
    await prisma.serviceRequest.update({
      where: { id: String(requestId) },
      data: {
        assignedToId: assignedToId === "" ? null : String(assignedToId),
        assignedAt: assignedToId === "" ? null : new Date(),
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Assign API error", error);
    return NextResponse.json({ success: false, message: "Server error" }, { status: 500 });
  }
}
