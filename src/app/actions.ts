"use server";

import { prisma } from "@/lib/prisma";
import { sendAssignmentWhatsApp, sendCustomerComplaintRegisteredWhatsApp } from "@/lib/whatsapp";
import { APP_ROLES, AUTH_ROLE_COOKIE, AUTH_USER_ID_COOKIE, type AppRole } from "@/lib/auth-constants";
import { getSession, roleCanAdmin, roleCanAssign, roleCanCreateService } from "@/lib/auth";
import {
  ATTENDANCE_POINTS,
  DOCUMENT_SUBMISSION_POINTS,
  MATERIAL_HANDOVER_POINTS,
  REVIEW_POINTS,
  TEAMWORK_POINTS,
  isAttendanceOption,
  isDocumentSubmissionOption,
  isMaterialHandoverOption,
  isReviewOption,
  isTeamworkOption,
} from "@/lib/employee-performance-rules";
import { normalizeStatus } from "./status-utils";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

function getRequiredField(formData: FormData, key: string) {
  const value = formData.get(key);

  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`Missing required field: ${key}`);
  }

  return value.trim();
}

const STATUS_SCORING_TIME_ZONE = "Asia/Kolkata";

function getLocalDateTimeParts(value: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(value);

  const lookup = (type: Intl.DateTimeFormatPartTypes) => {
    const part = parts.find((entry) => entry.type === type)?.value;

    if (!part) {
      throw new Error(`Missing ${type} date part`);
    }

    return Number.parseInt(part, 10);
  };

  return {
    year: lookup("year"),
    month: lookup("month"),
    day: lookup("day"),
    hour: lookup("hour"),
    minute: lookup("minute"),
  };
}

function getStatusSubmissionPoints(assignedAt: Date, submittedAt: Date) {
  const assignedParts = getLocalDateTimeParts(assignedAt, STATUS_SCORING_TIME_ZONE);
  const submittedParts = getLocalDateTimeParts(submittedAt, STATUS_SCORING_TIME_ZONE);

  const isSameAllocationDay =
    assignedParts.year === submittedParts.year &&
    assignedParts.month === submittedParts.month &&
    assignedParts.day === submittedParts.day;

  if (!isSameAllocationDay) {
    return -5;
  }

  const submittedMinutes = submittedParts.hour * 60 + submittedParts.minute;
  return submittedMinutes <= 21 * 60 ? 2 : -2;
}

function getAggregateAssignmentStatus(statuses: Array<string | null>) {
  const normalizedStatuses = statuses.map((status) => normalizeStatus(status));

  if (normalizedStatuses.length === 0) {
    return "New Call";
  }

  if (normalizedStatuses.every((status) => status === "Completed")) {
    return "Completed";
  }

  if (normalizedStatuses.every((status) => status === "Cancel")) {
    return "Cancel";
  }

  if (normalizedStatuses.some((status) => status !== "New Call")) {
    return "In Process";
  }

  return "New Call";
}

const SERVICE_BILLING_TYPES = ["warranty", "amc", "chargeable"] as const;
type ServiceBillingType = (typeof SERVICE_BILLING_TYPES)[number];

function getServiceBillingFields(formData: FormData, callType: string) {
  const serviceBillingTypeRaw = formData.get("serviceBillingType");
  const serviceBillingTypeValue =
    typeof serviceBillingTypeRaw === "string" ? serviceBillingTypeRaw.trim().toLowerCase() : "";

  let serviceBillingType: ServiceBillingType | null = null;
  let chargeableAmount: number | null = null;

  if (callType === "Service") {
    if (serviceBillingTypeValue !== "") {
      if (!SERVICE_BILLING_TYPES.includes(serviceBillingTypeValue as ServiceBillingType)) {
        throw new Error("Invalid service billing type");
      }

      serviceBillingType = serviceBillingTypeValue as ServiceBillingType;
    }

    if (serviceBillingType === "chargeable") {
      const amountRaw = formData.get("chargeableAmount");
      const amountValue = typeof amountRaw === "string" ? amountRaw.trim() : "";

      if (amountValue === "") {
        throw new Error("Chargeable amount is required for chargeable service calls");
      }

      const parsedAmount = Number.parseFloat(amountValue);
      if (Number.isNaN(parsedAmount) || parsedAmount < 0) {
        throw new Error("Invalid chargeable amount");
      }

      chargeableAmount = parsedAmount;
    }
  }

  return { serviceBillingType, chargeableAmount };
}

function redirectToDatabaseError() {
  redirect("/?error=2");
}

function getHighestDocketSequence(docketNumbers: Array<{ docketNumber: string }>) {
  let highest = 0;

  for (const entry of docketNumbers) {
    const match = /^srs-(\d+)$/i.exec(entry.docketNumber);
    if (!match) {
      continue;
    }

    const value = Number.parseInt(match[1], 10);
    if (Number.isNaN(value)) {
      continue;
    }

    highest = Math.max(highest, value);
  }

  return highest;
}

function isMonthReset(lastResetDate: Date | null): boolean {
  const now = new Date();
  if (!lastResetDate) {
    return true;
  }

  return lastResetDate.getMonth() !== now.getMonth() || lastResetDate.getFullYear() !== now.getFullYear();
}

async function handleMonthlyPointsReset(
  transaction: any,
  employeeId: string,
  currentMonthlyPoints: number,
  lastResetDate: Date | null,
) {
  if (!isMonthReset(lastResetDate)) {
    return; // No reset needed
  }

  const now = new Date();
  const lastMonth = new Date(now);
  lastMonth.setMonth(lastMonth.getMonth() - 1);

  if (lastResetDate) {
    // Store the previous month's points in history
    await (transaction as any).monthlyPerformanceHistory.upsert({
      where: {
        employeeId_year_month: {
          employeeId,
          year: lastMonth.getFullYear(),
          month: lastMonth.getMonth() + 1,
        },
      },
      update: {
        totalPoints: currentMonthlyPoints,
      },
      create: {
        employeeId,
        year: lastMonth.getFullYear(),
        month: lastMonth.getMonth() + 1,
        totalPoints: currentMonthlyPoints,
      },
    });
  }

  // Reset monthly points and update reset date
  await transaction.user.update({
    where: { id: employeeId },
    data: {
      monthlyPerformancePoints: 0,
      lastMonthlyResetDate: now,
    },
  });
}

async function requireSession() {
  const session = await getSession();
  if (!session) {
    redirect("/");
  }
  return session;
}

async function requireRole(allowedRoles: AppRole[]) {
  const session = await requireSession();

  if (!allowedRoles.includes(session.role)) {
    redirect("/dashboard");
  }

  return session;
}

export async function login(formData: FormData) {
  const username = getRequiredField(formData, "username");
  const password = getRequiredField(formData, "password");

  let user;

  try {
    user = await prisma.user.findFirst({
      where: {
        username: {
          equals: username,
          mode: "insensitive",
        },
      },
      select: { id: true, password: true, role: true },
    });
  } catch (error) {
    console.error("Authentication failed because the database is unavailable.", error);
    redirectToDatabaseError();
  }

  if (!user || user.password !== password) {
    redirect("/?error=1");
  }

  const cookieStore = await cookies();
  cookieStore.set(AUTH_USER_ID_COOKIE, String(user.id), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 12,
  });
  cookieStore.set(AUTH_ROLE_COOKIE, user.role, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 12,
  });

  redirect("/dashboard");
}

export async function logout() {
  const cookieStore = await cookies();
  cookieStore.delete(AUTH_USER_ID_COOKIE);
  cookieStore.delete(AUTH_ROLE_COOKIE);
  redirect("/");
}

export async function createServiceRequest(formData: FormData) {
  const session = await requireRole([APP_ROLES.ADMIN, APP_ROLES.MANAGER]);

  const name = getRequiredField(formData, "name");
  const company = getRequiredField(formData, "company");
  const phoneNumber1 = getRequiredField(formData, "phoneNumber1");
  const fullAddress = getRequiredField(formData, "fullAddress");
  const complaintDetails = getRequiredField(formData, "complaintDetails");
  const area = getRequiredField(formData, "area");
  const product = getRequiredField(formData, "product");
  const callType = getRequiredField(formData, "callType");
  const { serviceBillingType, chargeableAmount } = getServiceBillingFields(formData, callType);
  const phoneNumber2Value = formData.get("phoneNumber2");
  const phoneNumber2 =
    typeof phoneNumber2Value === "string" && phoneNumber2Value.trim() !== ""
      ? phoneNumber2Value.trim()
      : null;

  const request = await prisma.$transaction(async (transaction) => {
    const existingDockets = await transaction.serviceRequest.findMany({
      select: { docketNumber: true },
    });
    const nextSequence = getHighestDocketSequence(existingDockets) + 1;

    const created = await transaction.serviceRequest.create({
      data: {
        docketNumber: `srs-${nextSequence}`,
        name,
        company,
        phoneNumber1,
        phoneNumber2,
        fullAddress,
        complaintDetails,
        area,
        product,
        callType,
        serviceBillingType,
        chargeableAmount,
        createdById: session.userId,
      },
    });

    return created;
  });

  try {
    const whatsappResult = await sendCustomerComplaintRegisteredWhatsApp({
      toPhone: request.phoneNumber1,
      customerName: request.name,
      docketNumber: request.docketNumber,
    });

    if (!whatsappResult.sent) {
      console.warn("Customer WhatsApp complaint confirmation was not sent", {
        docketNumber: request.docketNumber,
        phoneNumber: request.phoneNumber1,
        reason: whatsappResult.reason,
      });
    }
  } catch (error) {
    console.error("Failed to send customer WhatsApp complaint confirmation", error);
  }

  revalidatePath("/form");
  revalidatePath("/dashboard");
  redirect(`/dashboard?created=${request.docketNumber}`);
}

export async function updateServiceRequestDetails(formData: FormData) {
  await requireRole([APP_ROLES.ADMIN, APP_ROLES.MANAGER]);

  const requestId = getRequiredField(formData, "requestId");
  const name = getRequiredField(formData, "name");
  const company = getRequiredField(formData, "company");
  const phoneNumber1 = getRequiredField(formData, "phoneNumber1");
  const fullAddress = getRequiredField(formData, "fullAddress");
  const complaintDetails = getRequiredField(formData, "complaintDetails");
  const area = getRequiredField(formData, "area");
  const product = getRequiredField(formData, "product");
  const callType = getRequiredField(formData, "callType");
  const { serviceBillingType, chargeableAmount } = getServiceBillingFields(formData, callType);
  const phoneNumber2Raw = formData.get("phoneNumber2");
  const phoneNumber2 =
    typeof phoneNumber2Raw === "string" && phoneNumber2Raw.trim() !== ""
      ? phoneNumber2Raw.trim()
      : null;

  await prisma.serviceRequest.update({
    where: { id: requestId },
    data: {
      name,
      company,
      phoneNumber1,
      phoneNumber2,
      fullAddress,
      complaintDetails,
      area,
      product,
      callType,
      serviceBillingType,
      chargeableAmount,
    },
  });

  revalidatePath("/dashboard");
}

export async function deleteServiceRequest(formData: FormData) {
  await requireRole([APP_ROLES.ADMIN, APP_ROLES.MANAGER]);

  const requestId = getRequiredField(formData, "requestId");

  await prisma.serviceRequest.delete({
    where: { id: requestId },
  });

  revalidatePath("/dashboard");
  revalidatePath("/form");
}

export async function addStaff(formData: FormData) {
  await requireRole([APP_ROLES.ADMIN]);

  const name = getRequiredField(formData, "name");
  const username = getRequiredField(formData, "username");
  const password = getRequiredField(formData, "password");
  const role = getRequiredField(formData, "role");
  const whatsappRaw = formData.get("whatsappNumber");
  const whatsappNumber = typeof whatsappRaw === "string" && whatsappRaw.trim() !== "" ? whatsappRaw.trim() : null;

  if (role !== APP_ROLES.MANAGER && role !== APP_ROLES.EMPLOYEE) {
    throw new Error("Invalid role selected");
  }

  await prisma.user.create({
    data: {
      name,
      username,
      password,
      whatsappNumber,
      role,
    },
  });

  revalidatePath("/admin");
  redirect("/admin?tab=staff");
}

export async function deleteStaff(formData: FormData) {
  await requireRole([APP_ROLES.ADMIN]);

  const id = getRequiredField(formData, "id");
  const user = await prisma.user.findUnique({
    where: { id },
    select: { role: true },
  });

  if (!user || (user.role !== APP_ROLES.MANAGER && user.role !== APP_ROLES.EMPLOYEE)) {
    redirect("/admin?tab=staff");
  }

  await prisma.user.delete({ where: { id } });

  revalidatePath("/admin");
  revalidatePath("/dashboard");
  redirect("/admin?tab=staff");
}

export async function updateStaff(formData: FormData) {
  await requireRole([APP_ROLES.ADMIN]);

  const id = getRequiredField(formData, "id");
  const name = getRequiredField(formData, "name");
  const username = getRequiredField(formData, "username");
  const role = getRequiredField(formData, "role");
  const whatsappRaw = formData.get("whatsappNumber");
  const whatsappNumber = typeof whatsappRaw === "string" && whatsappRaw.trim() !== "" ? whatsappRaw.trim() : null;

  if (role !== APP_ROLES.MANAGER && role !== APP_ROLES.EMPLOYEE) {
    throw new Error("Invalid role selected");
  }

  const user = await prisma.user.findUnique({
    where: { id },
    select: { role: true },
  });

  if (!user || (user.role !== APP_ROLES.MANAGER && user.role !== APP_ROLES.EMPLOYEE)) {
    redirect("/admin?tab=staff");
  }

  const updateData: Record<string, unknown> = {
    name,
    username,
    role,
    whatsappNumber,
  };

  const passwordRaw = formData.get("password");
  const password = typeof passwordRaw === "string" && passwordRaw.trim() !== "" ? passwordRaw.trim() : null;
  if (password) {
    updateData.password = password;
  }

  await prisma.user.update({
    where: { id },
    data: updateData,
  });

  revalidatePath("/admin");
  revalidatePath("/dashboard");
  redirect("/admin?tab=staff");
}

export async function addProduct(formData: FormData) {
  await requireRole([APP_ROLES.ADMIN]);

  const name = getRequiredField(formData, "name");
  const existingProduct = await prisma.product.findFirst({
    where: {
      name: {
        equals: name,
        mode: "insensitive",
      },
    },
    select: { id: true },
  });

  if (existingProduct) {
    redirect("/admin?tab=products&duplicate=1");
  }

  await prisma.product.create({ data: { name } });

  revalidatePath("/admin");
  revalidatePath("/form");
  redirect("/admin?tab=products");
}

export async function updateProduct(formData: FormData) {
  await requireRole([APP_ROLES.ADMIN]);

  const id = getRequiredField(formData, "id");
  const name = getRequiredField(formData, "name");
  const duplicateProduct = await prisma.product.findFirst({
    where: {
      id: { not: id },
      name: {
        equals: name,
        mode: "insensitive",
      },
    },
    select: { id: true },
  });

  if (duplicateProduct) {
    redirect("/admin?tab=products&duplicate=1");
  }

  await prisma.product.update({
    where: { id },
    data: { name },
  });

  revalidatePath("/admin");
  revalidatePath("/form");
  redirect("/admin?tab=products");
}

export async function deleteProduct(formData: FormData) {
  await requireRole([APP_ROLES.ADMIN]);

  const id = getRequiredField(formData, "id");

  await prisma.product.delete({ where: { id } });

  revalidatePath("/admin");
  revalidatePath("/form");
  redirect("/admin?tab=products");
}

export async function addCallType(formData: FormData) {
  await requireRole([APP_ROLES.ADMIN]);

  const name = getRequiredField(formData, "name");
  const existingCallType = await prisma.callType.findFirst({
    where: {
      name: {
        equals: name,
        mode: "insensitive",
      },
    },
    select: { id: true },
  });

  if (existingCallType) {
    redirect("/admin?tab=call-types&duplicate=1");
  }

  await prisma.callType.create({ data: { name } });

  revalidatePath("/admin");
  revalidatePath("/form");
  redirect("/admin?tab=call-types");
}

export async function updateCallType(formData: FormData) {
  await requireRole([APP_ROLES.ADMIN]);

  const id = getRequiredField(formData, "id");
  const name = getRequiredField(formData, "name");
  const duplicateCallType = await prisma.callType.findFirst({
    where: {
      id: { not: id },
      name: {
        equals: name,
        mode: "insensitive",
      },
    },
    select: { id: true },
  });

  if (duplicateCallType) {
    redirect("/admin?tab=call-types&duplicate=1");
  }

  await prisma.callType.update({
    where: { id },
    data: { name },
  });

  revalidatePath("/admin");
  revalidatePath("/form");
  redirect("/admin?tab=call-types");
}

export async function deleteCallType(formData: FormData) {
  await requireRole([APP_ROLES.ADMIN]);

  const id = getRequiredField(formData, "id");

  await prisma.callType.delete({ where: { id } });

  revalidatePath("/admin");
  revalidatePath("/form");
  redirect("/admin?tab=call-types");
}

export async function assignServiceCall(formData: FormData) {
  const session = await requireSession();

  if (!roleCanAssign(session.role)) {
    redirect("/dashboard");
  }

  const requestId = getRequiredField(formData, "requestId");
  const assignedToIdRaw = formData.get("assignedToId");
  const assignedToIdValue = typeof assignedToIdRaw === "string" ? assignedToIdRaw.trim() : "";
  const assignedToId = assignedToIdValue === "" ? null : assignedToIdValue;
  const previousRequest = await prisma.serviceRequest.findUnique({
    where: { id: requestId },
    select: {
      assignedToId: true,
      status: true,
      docketNumber: true,
      name: true,
      company: true,
      phoneNumber1: true,
      phoneNumber2: true,
      fullAddress: true,
      complaintDetails: true,
      area: true,
      product: true,
      callType: true,
    },
  });

  if (!previousRequest) {
    redirect("/dashboard");
  }

  const isCompletedRequest = normalizeStatus(previousRequest.status) === "Completed";
  if (isCompletedRequest && !roleCanAssign(session.role)) {
    redirect("/dashboard");
  }

  const shouldReopenForQueue =
    assignedToId !== null &&
    !!previousRequest &&
    (assignedToId !== previousRequest.assignedToId || normalizeStatus(previousRequest.status) !== "New Call");

  const allocationChanged = assignedToId !== previousRequest?.assignedToId;

  await prisma.serviceRequest.update({
    where: { id: requestId },
    data: {
      assignedToId,
      assignedAt:
        assignedToId === null
          ? null
          : shouldReopenForQueue || allocationChanged
            ? new Date()
            : undefined,
    },
  });

  const shouldNotify =
    !!previousRequest &&
    assignedToId !== null &&
    assignedToId !== previousRequest.assignedToId;

  if (shouldNotify) {
    const assignee = await prisma.user.findUnique({
      where: { id: assignedToId },
      select: { name: true, role: true, whatsappNumber: true },
    });

    if (assignee?.role === APP_ROLES.EMPLOYEE && assignee.whatsappNumber) {
      try {
        const whatsappResult = await sendAssignmentWhatsApp({
          toPhone: assignee.whatsappNumber,
          employeeName: assignee.name,
          docketNumber: previousRequest.docketNumber,
          customerName: previousRequest.name,
          company: previousRequest.company,
          phoneNumber1: previousRequest.phoneNumber1,
          phoneNumber2: previousRequest.phoneNumber2,
          fullAddress: previousRequest.fullAddress,
          complaintDetails: previousRequest.complaintDetails,
          area: previousRequest.area,
          product: previousRequest.product,
          callType: previousRequest.callType,
        });

        if (!whatsappResult.sent) {
          console.warn("WhatsApp allocation message was not sent", {
            requestId,
            assignedToId,
            reason: whatsappResult.reason,
          });
        }
      } catch (error) {
        console.error("Failed to send WhatsApp allocation message", error);
      }
    }
  }

  revalidatePath("/dashboard");
  redirect("/dashboard");
}

export async function updateServiceCallStatus(formData: FormData) {
  const session = await requireSession();

  // Only employees can update status
  if (session.role !== APP_ROLES.EMPLOYEE) {
    redirect("/dashboard");
  }

  const requestId = getRequiredField(formData, "requestId");
  const status = getRequiredField(formData, "status");
  const statusReason = formData.get("statusReason");
  const reasonValue = typeof statusReason === "string" ? statusReason.trim() : "";

  // Validate status values
  const validStatuses = ["New Call", "In Process", "Completed", "Cancel"];
  if (!validStatuses.includes(status)) {
    throw new Error("Invalid status");
  }

  let assignment = await prisma.serviceAssignment.findUnique({
    where: {
      requestId_employeeId: {
        requestId,
        employeeId: session.userId,
      },
    },
    include: {
      request: {
        select: {
          createdAt: true,
          assignedAt: true,
          assignedToId: true,
          status: true,
          statusReason: true,
          statusSubmittedAt: true,
          statusPointsDelta: true,
          closedByName: true,
          closedAt: true,
        },
      },
    },
  });

  if (!assignment) {
    const legacyRequest = await prisma.serviceRequest.findUnique({
      where: { id: requestId },
      select: {
        createdAt: true,
        assignedAt: true,
        assignedToId: true,
        status: true,
        statusReason: true,
        statusSubmittedAt: true,
        statusPointsDelta: true,
        closedByName: true,
        closedAt: true,
      },
    });

    if (legacyRequest?.assignedToId !== session.userId) {
      redirect("/dashboard");
    }

    assignment = await prisma.serviceAssignment.create({
      data: {
        requestId,
        employeeId: session.userId,
        assignedAt: legacyRequest.assignedAt ?? legacyRequest.createdAt,
        status: legacyRequest.status ?? "New Call",
        statusReason: legacyRequest.statusReason,
        statusSubmittedAt: legacyRequest.statusSubmittedAt,
        statusPointsDelta: legacyRequest.statusPointsDelta,
        closedByName: legacyRequest.closedByName,
        closedAt: legacyRequest.closedAt,
      },
      include: {
        request: {
          select: {
            createdAt: true,
            assignedAt: true,
            assignedToId: true,
            status: true,
            statusReason: true,
            statusSubmittedAt: true,
            statusPointsDelta: true,
            closedByName: true,
            closedAt: true,
          },
        },
      },
    });
  }

  const currentStatus = normalizeStatus(assignment.status);
  if (currentStatus === "Completed") {
    throw new Error("Completed calls are locked and cannot be updated.");
  }

  const allocationStartedAt = assignment.assignedAt ?? assignment.request.createdAt;
  const alreadyUpdatedForCurrentAllocation =
    !!assignment.statusSubmittedAt && assignment.statusSubmittedAt.getTime() >= allocationStartedAt.getTime();

  if (alreadyUpdatedForCurrentAllocation) {
    throw new Error("Status can only be updated once per allotment.");
  }

  if (status === "New Call") {
    throw new Error("Please choose a status other than New Call.");
  }

  if (status === "Completed") {
    const path = await import("path");
    const fs = await import("fs");
    const os = await import("os");

    const publicUploads = path.join(process.cwd(), "public", "uploads");
    const tmpUploads = path.join(os.tmpdir(), "srs-uploads");

    const requestDirsToCheck = [];
    if (process.env.USE_TMP_UPLOADS === "1") {
      requestDirsToCheck.push(path.join(tmpUploads, session.userId, requestId));
    }
    requestDirsToCheck.push(path.join(publicUploads, session.userId, requestId));

    let hasMedia = false;
    for (const dir of requestDirsToCheck) {
      // check directory for any file except .DS_Store
      // ignore errors and continue to next location
      // eslint-disable-next-line no-await-in-loop
      const exists = await fs.promises
        .readdir(dir)
        .then((entries) => entries.some((entry) => entry !== ".DS_Store"))
        .catch(() => false);

      if (exists) {
        hasMedia = true;
        break;
      }
    }

    if (!hasMedia) {
      throw new Error("Please upload at least one image or video before marking this call as Completed.");
    }
  }

  const employee = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { name: true },
  });

  const submittedAt = new Date();
  const pointsDelta = getStatusSubmissionPoints(assignment.assignedAt ?? assignment.request.createdAt, submittedAt);

  await prisma.$transaction(async (transaction) => {
    await transaction.serviceAssignment.update({
      where: { id: assignment.id },
      data: {
        status,
        statusReason: reasonValue || null,
        statusSubmittedAt: submittedAt,
        statusPointsDelta: pointsDelta,
        closedByName: status === "Completed" ? (employee?.name || "Unknown") : null,
        closedAt: status === "Completed" ? submittedAt : null,
      },
    });

    const updatedAssignments = await transaction.serviceAssignment.findMany({
      where: { requestId },
      select: {
        status: true,
        statusReason: true,
        statusSubmittedAt: true,
        closedByName: true,
        closedAt: true,
      },
    });
    const aggregateStatus = getAggregateAssignmentStatus(updatedAssignments.map((item) => item.status));
    const latestSubmitted = updatedAssignments
      .filter((item) => item.statusSubmittedAt)
      .sort((a, b) => (b.statusSubmittedAt?.getTime() ?? 0) - (a.statusSubmittedAt?.getTime() ?? 0))[0];
    const closedAssignments = updatedAssignments.filter((item) => item.closedAt);
    const latestClosedAt = closedAssignments
      .map((item) => item.closedAt)
      .filter((value): value is Date => value instanceof Date)
      .sort((a, b) => b.getTime() - a.getTime())[0] ?? null;

    await transaction.serviceRequest.update({
      where: { id: requestId },
      data: {
        status: aggregateStatus,
        statusReason: latestSubmitted?.statusReason || null,
        customerReview: null,
        statusSubmittedAt: latestSubmitted?.statusSubmittedAt || submittedAt,
        statusPointsDelta: pointsDelta,
        reviewPointsDelta: null,
        closedByName:
          aggregateStatus === "Completed"
            ? closedAssignments.map((item) => item.closedByName).filter(Boolean).join(", ") || null
            : null,
        closedAt: aggregateStatus === "Completed" ? latestClosedAt : null,
      },
    });

    await transaction.user.update({
      where: { id: session.userId },
      data: {
        performancePoints: {
          increment: pointsDelta,
        },
      },
    });
  });

  revalidatePath("/dashboard");
}

export async function addEmployeePerformanceAdjustment(formData: FormData) {
  const session = await requireSession();

  if (!roleCanAssign(session.role)) {
    redirect("/dashboard");
  }

  const employeeId = getRequiredField(formData, "employeeId");
  const attendanceRaw = getRequiredField(formData, "attendanceOption");
  const reviewRaw = getRequiredField(formData, "reviewOption");
  const documentSubmissionRaw = getRequiredField(formData, "documentSubmissionOption");
  const materialHandoverRaw = getRequiredField(formData, "materialHandoverOption");
  const teamworkRaw = getRequiredField(formData, "teamworkOption");

  if (!isAttendanceOption(attendanceRaw)) {
    throw new Error("Invalid attendance option");
  }

  if (!isReviewOption(reviewRaw)) {
    throw new Error("Invalid review option");
  }

  if (!isDocumentSubmissionOption(documentSubmissionRaw)) {
    throw new Error("Invalid document submission option");
  }

  if (!isMaterialHandoverOption(materialHandoverRaw)) {
    throw new Error("Invalid material handover option");
  }

  if (!isTeamworkOption(teamworkRaw)) {
    throw new Error("Invalid teamwork option");
  }

  const attendance = ATTENDANCE_POINTS[attendanceRaw];
  const review = REVIEW_POINTS[reviewRaw];
  const documentSubmission = DOCUMENT_SUBMISSION_POINTS[documentSubmissionRaw];
  const materialHandover = MATERIAL_HANDOVER_POINTS[materialHandoverRaw];
  const teamwork = TEAMWORK_POINTS[teamworkRaw];
  const totalDelta =
    attendance.points + review.points + documentSubmission.points + materialHandover.points + teamwork.points;

  try {
    await prisma.$transaction(async (transaction) => {
      const employee = await transaction.user.findUnique({
        where: { id: employeeId },
        select: { id: true, role: true, monthlyPerformancePoints: true, lastMonthlyResetDate: true },
      });

      if (!employee || employee.role !== APP_ROLES.EMPLOYEE) {
        throw new Error("Employee not found");
      }

      // Handle monthly reset if needed
      await handleMonthlyPointsReset(
        transaction,
        employeeId,
        employee.monthlyPerformancePoints,
        employee.lastMonthlyResetDate,
      );

      try {
        await (transaction as any).employeePointAdjustment.create({
          data: {
            employeeId,
            updatedById: session.userId,
            attendanceOption: attendance.label,
            attendancePoints: attendance.points,
            reviewOption: review.label,
            reviewPoints: review.points,
            documentSubmissionOption: documentSubmission.label,
            documentSubmissionPoints: documentSubmission.points,
            materialHandoverOption: materialHandover.label,
            materialHandoverPoints: materialHandover.points,
            teamworkOption: teamwork.label,
            teamworkPoints: teamwork.points,
            totalDelta,
          },
        });
      } catch (error) {
        const code = (error as { code?: string } | null)?.code;
        const message = error instanceof Error ? error.message : "";
        const isMissingPointAdjustmentTable =
          code === "P2021" ||
          message.toLowerCase().includes("employeepointadjustment") ||
          message.toLowerCase().includes("does not exist");

        if (!isMissingPointAdjustmentTable) {
          throw error;
        }

        console.warn("Skipping EmployeePointAdjustment log write because the table/delegate is not ready yet.", {
          employeeId,
          reason: message || code || "unknown",
        });
      }

      await transaction.user.update({
        where: { id: employeeId },
        data: {
          performancePoints: {
            increment: totalDelta,
          },
          monthlyPerformancePoints: {
            increment: totalDelta,
          },
        },
      });
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to update points";
    throw new Error(message);
  }

  revalidatePath("/report");
  revalidatePath("/dashboard");
}

export async function canOpenAdmin(): Promise<boolean> {
  const session = await getSession();
  return !!session && roleCanAdmin(session.role);
}

export async function canCreateService(): Promise<boolean> {
  const session = await getSession();
  return !!session && roleCanCreateService(session.role);
}

export async function uploadEmployeeImage(formData: FormData) {
  const session = await requireSession();

  // Only employees may upload images for their gallery
  if (session.role !== APP_ROLES.EMPLOYEE) {
    redirect("/dashboard");
  }

  const requestId = getRequiredField(formData, "requestId");
  const file = formData.get("file") as File | null;
  if (!file || typeof file === "string") {
    throw new Error("No file uploaded");
  }

  const allowedTypes = [
    "image/png",
    "image/jpeg",
    "image/jpg",
    "image/webp",
    "image/gif",
    "video/mp4",
    "video/webm",
    "video/quicktime",
    "video/ogg",
    "video/x-msvideo",
    "video/x-matroska",
    "video/3gpp",
    "video/x-ms-wmv",
    "video/x-m4v",
  ];
  const allowedExtensions = [
    "png",
    "jpeg",
    "jpg",
    "webp",
    "gif",
    "mp4",
    "m4v",
    "webm",
    "mov",
    "qt",
    "ogv",
    "avi",
    "mkv",
    "3gp",
    "wmv",
  ];
  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
  const isAllowedType = file.type ? allowedTypes.includes(file.type) : false;
  const isAllowedExtension = allowedExtensions.includes(extension);

  if (!isAllowedType && !isAllowedExtension) {
    throw new Error("Unsupported file type");
  }

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  const path = await import("path");
  const fs = await import("fs");
  const os = await import("os");

  // On platforms like Vercel the server filesystem is effectively read-only
  // across invocations. For production deployments use an object store
  // (S3/Cloudinary). For quick ephemeral testing you can set
  // USE_TMP_UPLOADS=1 to write to the runtime's temp directory.
  if (process.env.VERCEL === "1" && process.env.USE_TMP_UPLOADS !== "1") {
    throw new Error(
      "Cannot write uploaded files to disk on serverless platforms (e.g. Vercel). Configure external object storage (S3/Cloudinary) or set USE_TMP_UPLOADS=1 for ephemeral testing.",
    );
  }

  const uploadsBase =
    process.env.USE_TMP_UPLOADS === "1"
      ? path.join(os.tmpdir(), "srs-uploads")
      : path.join(process.cwd(), "public", "uploads");

  const requestDir = path.join(uploadsBase, session.userId, requestId);

  await fs.promises.mkdir(requestDir, { recursive: true });

  const timestamp = Date.now();
  const safeName = `${timestamp}-${sanitizeFileName(file.name)}`;
  const filePath = path.join(requestDir, safeName);

  await fs.promises.writeFile(filePath, buffer);

  revalidatePath("/dashboard");
}

function sanitizeFileName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, "-").slice(0, 200);
}
