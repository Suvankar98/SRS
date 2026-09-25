import "server-only";

import type { Prisma } from "@prisma/client";

import type { EmployeeReportRequest } from "@/lib/employee-report";
import { prisma } from "@/lib/prisma";

export type EmployeeReportPerson = {
  id: string;
  name: string;
};

export type EmployeeReportInputs = {
  activeRequests: EmployeeReportRequest[];
  reportRequests: EmployeeReportRequest[];
};

const employeeReportRequestSelect = {
  id: true,
  docketNumber: true,
  name: true,
  company: true,
  area: true,
  status: true,
  statusReason: true,
  statusPointsDelta: true,
  assignedToId: true,
  createdAt: true,
  assignedAt: true,
  statusSubmittedAt: true,
  lastAttemptAt: true,
  lastAttemptByName: true,
  closedAt: true,
  closedByName: true,
} satisfies Prisma.ServiceRequestSelect;

export async function getEmployeeReportData(employees: EmployeeReportPerson[]) {
  const inputsByEmployeeId = new Map<string, EmployeeReportInputs>();
  const employeeIdsByName = new Map<string, string[]>();

  for (const employee of employees) {
    inputsByEmployeeId.set(employee.id, { activeRequests: [], reportRequests: [] });

    const nameKey = getEmployeeNameKey(employee.name);
    if (!nameKey) {
      continue;
    }

    const ids = employeeIdsByName.get(nameKey) ?? [];
    ids.push(employee.id);
    employeeIdsByName.set(nameKey, ids);
  }

  const employeeIds = employees.map((employee) => employee.id);
  if (employeeIds.length === 0) {
    return { inputsByEmployeeId, linkedRequests: [] };
  }

  const employeeNameFilters = employees
    .map((employee) => employee.name.trim())
    .filter(Boolean)
    .flatMap((name) => [
      { lastAttemptByName: { equals: name, mode: "insensitive" as const } },
      { closedByName: { equals: name, mode: "insensitive" as const } },
    ]);

  const [assignments, activities, linkedRequests] = await Promise.all([
    prisma.serviceAssignment.findMany({
      where: {
        employeeId: { in: employeeIds },
        request: { deletedAt: null },
      },
      orderBy: { assignedAt: "desc" },
      select: {
        id: true,
        employeeId: true,
        assignedAt: true,
        status: true,
        statusReason: true,
        statusSubmittedAt: true,
        statusPointsDelta: true,
        closedAt: true,
        request: { select: employeeReportRequestSelect },
      },
    }),
    prisma.serviceRequestActivity.findMany({
      where: {
        employeeId: { in: employeeIds },
        statusPointsDelta: { not: null },
        request: { deletedAt: null },
      },
      orderBy: [{ statusSubmittedAt: "desc" }, { createdAt: "desc" }],
      select: {
        id: true,
        employeeId: true,
        statusAssignmentId: true,
        status: true,
        statusReason: true,
        statusAssignedAt: true,
        statusSubmittedAt: true,
        statusPointsDelta: true,
        createdAt: true,
        request: { select: employeeReportRequestSelect },
      },
    }),
    prisma.serviceRequest.findMany({
      where: {
        deletedAt: null,
        OR: [{ assignedToId: { in: employeeIds } }, ...employeeNameFilters],
      },
      select: employeeReportRequestSelect,
      orderBy: [{ lastAttemptAt: "desc" }, { statusSubmittedAt: "desc" }, { createdAt: "desc" }],
    }),
  ]);

  const activityAssignmentIds = new Set(
    activities.flatMap((activity) => activity.statusAssignmentId ? [activity.statusAssignmentId] : []),
  );
  const activityRequestKeys = new Set(
    activities.flatMap((activity) => activity.employeeId ? [`${activity.employeeId}:${activity.request.id}`] : []),
  );
  const linkedRequestKeys = new Set<string>();

  for (const assignment of assignments) {
    const input = inputsByEmployeeId.get(assignment.employeeId);
    if (!input) {
      continue;
    }

    input.activeRequests.push({
      ...assignment.request,
      assignedAt: assignment.assignedAt,
      status: assignment.status ?? assignment.request.status,
      statusReason: assignment.statusReason ?? assignment.request.statusReason,
      statusSubmittedAt: assignment.statusSubmittedAt,
      statusPointsDelta:
        activityAssignmentIds.has(assignment.id) || activityRequestKeys.has(`${assignment.employeeId}:${assignment.request.id}`)
          ? null
          : assignment.statusPointsDelta,
      closedAt: assignment.closedAt ?? assignment.request.closedAt,
    });

    linkedRequestKeys.add(`${assignment.employeeId}:${assignment.request.id}`);
  }

  for (const activity of activities) {
    if (!activity.employeeId || typeof activity.statusPointsDelta !== "number") {
      continue;
    }

    const input = inputsByEmployeeId.get(activity.employeeId);
    if (!input) {
      continue;
    }

    input.activeRequests.push({
      ...activity.request,
      reportEntryId: `activity:${activity.id}`,
      assignedAt: activity.statusAssignedAt ?? activity.request.assignedAt,
      status: activity.status ?? activity.request.status,
      statusReason: activity.statusReason ?? activity.request.statusReason,
      statusSubmittedAt: activity.statusSubmittedAt ?? activity.createdAt,
      statusPointsDelta: activity.statusPointsDelta,
      lastAttemptAt: null,
    });

    linkedRequestKeys.add(`${activity.employeeId}:${activity.request.id}`);
  }

  for (const request of linkedRequests) {
    const matchingEmployeeIds = new Set<string>();

    if (request.assignedToId) {
      matchingEmployeeIds.add(request.assignedToId);
    }

    for (const name of [request.lastAttemptByName, request.closedByName]) {
      const nameKey = getEmployeeNameKey(name);
      for (const employeeId of nameKey ? employeeIdsByName.get(nameKey) ?? [] : []) {
        matchingEmployeeIds.add(employeeId);
      }
    }

    for (const employeeId of matchingEmployeeIds) {
      const input = inputsByEmployeeId.get(employeeId);
      if (input && !linkedRequestKeys.has(`${employeeId}:${request.id}`)) {
        input.reportRequests.push(request);
      }
    }
  }

  return { inputsByEmployeeId, linkedRequests };
}

function getEmployeeNameKey(value: string | null) {
  return value?.trim().toLowerCase() ?? "";
}
