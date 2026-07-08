import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession, roleCanAssign } from "@/lib/auth";
import { normalizeStatus } from "@/app/status-utils";
import { APP_ROLES } from "@/lib/auth-constants";

const COMPLETED_REASSIGN_WINDOW_MS = 72 * 60 * 60 * 1000;

function getAssignedEmployeeIds(body: { assignedToId?: unknown; assignedToIds?: unknown }) {
  const rawIds = Array.isArray(body.assignedToIds) ? body.assignedToIds : [body.assignedToId];

  return Array.from(
    new Set(
      rawIds
        .filter((value): value is string => typeof value === "string")
        .map((value) => value.trim())
        .filter(Boolean),
    ),
  );
}

function getCompletedAt(serviceRequest: {
  closedAt: Date | null;
  statusSubmittedAt: Date | null;
  lastAttemptAt: Date | null;
}) {
  return serviceRequest.closedAt ?? serviceRequest.statusSubmittedAt ?? serviceRequest.lastAttemptAt;
}

function isCompletedReassignWindowOpen(completedAt: Date | null) {
  if (!completedAt) {
    return false;
  }

  return Date.now() - completedAt.getTime() <= COMPLETED_REASSIGN_WINDOW_MS;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { requestId } = body;
    const assignedEmployeeIds = getAssignedEmployeeIds(body);

    const session = await getSession();
    if (!session || !roleCanAssign(session.role)) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 403 });
    }

    const serviceRequest = await prisma.serviceRequest.findUnique({
      where: { id: String(requestId) },
      select: {
        status: true,
        statusReason: true,
        closedByName: true,
        closedAt: true,
        statusSubmittedAt: true,
        lastAttemptAt: true,
      },
    });

    if (!serviceRequest) {
      return NextResponse.json({ success: false, message: "Service request not found" }, { status: 404 });
    }

    const isCompletedRequest = normalizeStatus(serviceRequest.status) === "Completed";
    if (isCompletedRequest && !isCompletedReassignWindowOpen(getCompletedAt(serviceRequest))) {
      return NextResponse.json(
        { success: false, message: "Reassign window closed after 72 hours." },
        { status: 400 },
      );
    }

    const validEmployees = assignedEmployeeIds.length
      ? await prisma.user.findMany({
          where: {
            id: { in: assignedEmployeeIds },
            role: APP_ROLES.EMPLOYEE,
          },
          select: { id: true },
        })
      : [];
    const validEmployeeIds = validEmployees.map((employee) => employee.id);
    const assignedAt = new Date();
    const isReopeningCompletedRequest = isCompletedRequest && validEmployeeIds.length > 0;
    const assignmentStatus = isReopeningCompletedRequest ? "New Call" : normalizeStatus(serviceRequest.status);

    await prisma.$transaction(async (transaction) => {
      if (validEmployeeIds.length === 0) {
        await transaction.serviceAssignment.deleteMany({
          where: { requestId: String(requestId) },
        });
      } else {
        await transaction.serviceAssignment.deleteMany({
          where: {
            requestId: String(requestId),
            employeeId: { notIn: validEmployeeIds },
          },
        });

        const existingAssignments = await transaction.serviceAssignment.findMany({
          where: { requestId: String(requestId) },
          select: { employeeId: true },
        });
        const existingEmployeeIds = new Set(existingAssignments.map((assignment) => assignment.employeeId));
        const newEmployeeIds = validEmployeeIds.filter((employeeId) => !existingEmployeeIds.has(employeeId));

        if (newEmployeeIds.length > 0) {
          await transaction.serviceAssignment.createMany({
            data: newEmployeeIds.map((employeeId) => ({
              requestId: String(requestId),
              employeeId,
              assignedAt,
              status: assignmentStatus,
              statusReason: serviceRequest.statusReason,
              closedByName: assignmentStatus === "Completed" ? serviceRequest.closedByName : null,
              closedAt: assignmentStatus === "Completed" ? serviceRequest.closedAt : null,
            })),
            skipDuplicates: true,
          });
        }
      }

      await transaction.serviceRequest.update({
        where: { id: String(requestId) },
        data: {
          assignedToId: validEmployeeIds[0] ?? null,
          assignedAt: validEmployeeIds.length > 0 ? assignedAt : null,
          ...(isReopeningCompletedRequest
            ? {
                status: "New Call",
                statusReason: null,
                customerReview: null,
                statusSubmittedAt: null,
                statusPointsDelta: null,
                reviewPointsDelta: null,
                closedByName: null,
                closedAt: null,
              }
            : {}),
        },
      });
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Assign API error", error);
    return NextResponse.json({ success: false, message: "Server error" }, { status: 500 });
  }
}
