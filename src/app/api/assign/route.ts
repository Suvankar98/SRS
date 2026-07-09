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
          select: { id: true, name: true },
        })
      : [];
    const validEmployeeIds = validEmployees.map((employee) => employee.id);
    const validEmployeeNames = new Map(validEmployees.map((employee) => [employee.id, employee.name]));
    const actor = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { name: true },
    });
    const assignedAt = new Date();
    const isReopeningCompletedRequest = isCompletedRequest && validEmployeeIds.length > 0;
    const assignmentStatus = isReopeningCompletedRequest ? "New Call" : normalizeStatus(serviceRequest.status);

    await prisma.$transaction(async (transaction) => {
      const existingAssignments = await transaction.serviceAssignment.findMany({
        where: { requestId: String(requestId) },
        select: { employeeId: true, employee: { select: { name: true } } },
      });
      const existingEmployeeIds = new Set(existingAssignments.map((assignment) => assignment.employeeId));

      if (validEmployeeIds.length === 0) {
        await transaction.serviceAssignment.deleteMany({
          where: { requestId: String(requestId) },
        });

        if (existingAssignments.length > 0) {
          await transaction.serviceRequestActivity.create({
            data: {
              requestId: String(requestId),
              type: "unassigned",
              title: "Service Request Unassigned",
              details: `Removed assignment for ${existingAssignments.map((assignment) => assignment.employee?.name ?? "Employee").join(", ")}`,
              status: serviceRequest.status,
              actorId: session.userId,
              actorName: actor?.name ?? "Admin / Manager",
              actorRole: session.role,
              createdAt: assignedAt,
            },
          });
        }
      } else {
        await transaction.serviceAssignment.deleteMany({
          where: {
            requestId: String(requestId),
            employeeId: { notIn: validEmployeeIds },
          },
        });

        const newEmployeeIds = validEmployeeIds.filter((employeeId) => !existingEmployeeIds.has(employeeId));
        const removedAssignments = existingAssignments.filter(
          (assignment) => !validEmployeeIds.includes(assignment.employeeId),
        );

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

          await transaction.serviceRequestActivity.createMany({
            data: newEmployeeIds.map((employeeId) => ({
              requestId: String(requestId),
              type: "assigned",
              title: "Service Request Assigned",
              details: `Assigned to ${validEmployeeNames.get(employeeId) ?? "Employee"}`,
              status: assignmentStatus,
              actorId: session.userId,
              actorName: actor?.name ?? "Admin / Manager",
              actorRole: session.role,
              employeeId,
              employeeName: validEmployeeNames.get(employeeId) ?? null,
              createdAt: assignedAt,
            })),
          });
        }

        if (removedAssignments.length > 0) {
          await transaction.serviceRequestActivity.createMany({
            data: removedAssignments.map((assignment) => ({
              requestId: String(requestId),
              type: "unassigned",
              title: "Employee Removed from Service Request",
              details: `Removed ${assignment.employee?.name ?? "Employee"} from assignment`,
              status: serviceRequest.status,
              actorId: session.userId,
              actorName: actor?.name ?? "Admin / Manager",
              actorRole: session.role,
              employeeId: assignment.employeeId,
              employeeName: assignment.employee?.name ?? null,
              createdAt: assignedAt,
            })),
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
