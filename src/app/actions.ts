"use server";

import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { PHONE_VALIDATION_MESSAGE, normalizePhoneNumberForStorage } from "@/lib/phone";
import { sendAssignmentWhatsApp, sendCustomerComplaintRegisteredWhatsApp } from "@/lib/whatsapp";
import { APP_ROLES, AUTH_ROLE_COOKIE, AUTH_USER_ID_COOKIE, type AppRole } from "@/lib/auth-constants";
import { getSession, roleCanAdmin, roleCanAssign, roleCanCreateService } from "@/lib/auth";
import {
  ATTENDANCE_IN_POINTS,
  ATTENDANCE_OUT_POINTS,
  DOCUMENT_SUBMISSION_POINTS,
  MATERIAL_HANDOVER_POINTS,
  REVIEW_POINTS,
  isAttendanceInOption,
  isAttendanceOutOption,
  isDocumentSubmissionOption,
  isMaterialHandoverOption,
  isReviewOption,
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

function getOptionalField(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function getOptionalNullableField(formData: FormData, key: string) {
  const value = formData.get(key);
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

const STATUS_SCORING_TIME_ZONE = "Asia/Kolkata";
const PERFORMANCE_TIME_ZONE = "Asia/Kolkata";

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
    return -4;
  }

  const submittedMinutes = submittedParts.hour * 60 + submittedParts.minute;
  return submittedMinutes <= 21 * 60 ? 4 : 2;
}

function getLocalDateKey(value: Date, timeZone: string) {
  const parts = getLocalDateTimeParts(value, timeZone);
  const pad = (part: number) => String(part).padStart(2, "0");

  return `${parts.year}-${pad(parts.month)}-${pad(parts.day)}`;
}

function getLocalDayRange(value: Date, timeZone: string) {
  const dateKey = getLocalDateKey(value, timeZone);

  return {
    startAt: new Date(`${dateKey}T00:00:00.000+05:30`),
    endAt: new Date(`${dateKey}T23:59:59.999+05:30`),
  };
}

async function shouldAwardStatusSubmissionPoints({
  transaction,
  employeeId,
  employeeName,
  assignedAt,
}: {
  transaction: Prisma.TransactionClient;
  employeeId: string;
  employeeName: string;
  assignedAt: Date;
}) {
  const allocationDayRange = getLocalDayRange(assignedAt, STATUS_SCORING_TIME_ZONE);

  const [remainingAssignedServices, alreadyScoredRequests] = await Promise.all([
    transaction.serviceAssignment.count({
      where: {
        employeeId,
        assignedAt: {
          gte: allocationDayRange.startAt,
          lte: allocationDayRange.endAt,
        },
        statusSubmittedAt: null,
        request: { deletedAt: null },
      },
    }),
    transaction.serviceRequest.count({
      where: {
        deletedAt: null,
        statusPointsDelta: { not: null },
        statusSubmittedAt: {
          gte: allocationDayRange.startAt,
          lte: allocationDayRange.endAt,
        },
        OR: [
          { lastAttemptByName: { equals: employeeName, mode: "insensitive" } },
          { closedByName: { equals: employeeName, mode: "insensitive" } },
        ],
      },
    }),
  ]);

  return remainingAssignedServices <= 1 && alreadyScoredRequests === 0;
}

type AssignmentStatusSummaryInput = {
  employeeId: string;
  assignedAt: Date;
  status: string | null;
  statusReason: string | null;
  statusSubmittedAt: Date | null;
  statusPointsDelta: number | null;
  closedAt: Date | null;
  employee?: { name: string } | null;
};

function getAggregateAssignmentStatus(assignments: AssignmentStatusSummaryInput[]) {
  if (assignments.length === 0) {
    return "New Call";
  }

  const statuses = assignments.map((assignment) => normalizeStatus(assignment.status));

  if (statuses.includes("In Process")) {
    return "In Process";
  }

  const hasCompleted = statuses.includes("Completed");
  const hasNewCall = statuses.includes("New Call");
  const hasCancel = statuses.includes("Cancel");

  if (hasCompleted && (hasNewCall || hasCancel)) {
    return "In Process";
  }

  if (hasCompleted && statuses.every((status) => status === "Completed")) {
    return "Completed";
  }

  if (hasCancel && statuses.every((status) => status === "Cancel")) {
    return "Cancel";
  }

  if (hasCancel && hasNewCall) {
    return "In Process";
  }

  return "New Call";
}

function getLatestSubmittedAssignment(assignments: AssignmentStatusSummaryInput[]) {
  return assignments
    .filter((assignment) => assignment.statusSubmittedAt)
    .sort((a, b) => (b.statusSubmittedAt?.getTime() ?? 0) - (a.statusSubmittedAt?.getTime() ?? 0))[0] ?? null;
}

function getPrimaryOpenAssignment(assignments: AssignmentStatusSummaryInput[]) {
  return (
    assignments
      .filter((assignment) => !assignment.statusSubmittedAt)
      .sort((a, b) => a.assignedAt.getTime() - b.assignedAt.getTime())[0] ??
    assignments.sort((a, b) => a.assignedAt.getTime() - b.assignedAt.getTime())[0] ??
    null
  );
}

function getRequiredPhoneField(formData: FormData, key: string, label: string) {
  const value = getRequiredField(formData, key);
  const normalized = normalizePhoneNumberForStorage(value);

  if (!normalized) {
    throw new Error(`${label}: ${PHONE_VALIDATION_MESSAGE}`);
  }

  return normalized;
}

function getOptionalPhoneField(formData: FormData, key: string, label: string) {
  const value = formData.get(key);

  if (typeof value !== "string" || value.trim() === "") {
    return null;
  }

  const normalized = normalizePhoneNumberForStorage(value);
  if (!normalized) {
    throw new Error(`${label}: ${PHONE_VALIDATION_MESSAGE}`);
  }

  return normalized;
}

function isPhoneValidationError(error: unknown) {
  return error instanceof Error && error.message.includes(PHONE_VALIDATION_MESSAGE);
}

function parsePerformanceAdjustmentDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error("Invalid adjustment date");
  }

  const adjustmentDate = new Date(`${value}T12:00:00.000+05:30`);
  if (Number.isNaN(adjustmentDate.getTime())) {
    throw new Error("Invalid adjustment date");
  }

  const todayInputValue = new Intl.DateTimeFormat("en-CA", {
    timeZone: PERFORMANCE_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());

  if (value > todayInputValue) {
    throw new Error("Adjustment date cannot be in the future");
  }

  return adjustmentDate;
}

function getPerformanceAdjustmentDateRange(value: Date) {
  const parts = getLocalDateTimeParts(value, PERFORMANCE_TIME_ZONE);
  const dateInput = `${parts.year}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`;
  const startAt = new Date(`${dateInput}T00:00:00.000+05:30`);
  const endAt = new Date(startAt.getTime() + 24 * 60 * 60 * 1000);

  return { startAt, endAt };
}

function isCurrentPerformanceMonth(value: Date) {
  const target = getLocalDateTimeParts(value, PERFORMANCE_TIME_ZONE);
  const current = getLocalDateTimeParts(new Date(), PERFORMANCE_TIME_ZONE);

  return target.year === current.year && target.month === current.month;
}

const DASHBOARD_STATUSES = ["New Call", "In Process", "Completed", "Cancel"] as const;
const STAFF_DEPARTMENTS = ["sales", "service", "backoffice"] as const;
const COMPLETED_REASSIGN_WINDOW_MS = 72 * 60 * 60 * 1000;
type StaffDepartment = (typeof STAFF_DEPARTMENTS)[number];

function getDashboardStatus(value: string) {
  const status = normalizeStatus(value);

  if (!DASHBOARD_STATUSES.includes(status)) {
    throw new Error("Invalid status");
  }

  return status;
}

function getStaffDepartment(formData: FormData) {
  const department = getRequiredField(formData, "department").toLowerCase();

  if (!STAFF_DEPARTMENTS.includes(department as StaffDepartment)) {
    throw new Error("Invalid department selected");
  }

  return department as StaffDepartment;
}

function getCompletedAtForReassign(request: {
  closedAt?: Date | null;
  statusSubmittedAt?: Date | null;
  lastAttemptAt?: Date | null;
}) {
  return request.closedAt ?? request.statusSubmittedAt ?? request.lastAttemptAt ?? null;
}

function isCompletedReassignWindowOpen(completedAt: Date | null) {
  if (!completedAt) {
    return false;
  }

  return Date.now() - completedAt.getTime() <= COMPLETED_REASSIGN_WINDOW_MS;
}

function getActorRoleLabel(role: AppRole) {
  return role === APP_ROLES.ADMIN ? "Admin" : role === APP_ROLES.MANAGER ? "Manager" : "Employee";
}

async function addServiceActivity(
  transaction: Prisma.TransactionClient,
  data: {
    requestId: string;
    type: string;
    title: string;
    details?: string | null;
    status?: string | null;
    statusReason?: string | null;
    actorId?: string | null;
    actorName?: string | null;
    actorRole?: string | null;
    employeeId?: string | null;
    employeeName?: string | null;
    createdAt?: Date;
  },
) {
  await transaction.serviceRequestActivity.create({
    data: {
      requestId: data.requestId,
      type: data.type,
      title: data.title,
      details: data.details ?? null,
      status: data.status ?? null,
      statusReason: data.statusReason ?? null,
      actorId: data.actorId ?? null,
      actorName: data.actorName ?? null,
      actorRole: data.actorRole ?? null,
      employeeId: data.employeeId ?? null,
      employeeName: data.employeeName ?? null,
      createdAt: data.createdAt,
    },
  });
}

function shouldUseTmpUploads() {
  return process.env.USE_TMP_UPLOADS === "1" || process.env.VERCEL === "1";
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
  transaction: Prisma.TransactionClient,
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
    await transaction.monthlyPerformanceHistory.upsert({
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
  const contactPerson2 = getOptionalNullableField(formData, "contactPerson2");
  let phoneNumber1: string;
  let phoneNumber2: string | null;

  try {
    phoneNumber1 = getRequiredPhoneField(formData, "phoneNumber1", "Phone Number 1");
    phoneNumber2 = getOptionalPhoneField(formData, "phoneNumber2", "Phone Number 2");
  } catch (error) {
    if (isPhoneValidationError(error)) {
      redirect("/form?phoneError=1");
    }

    throw error;
  }

  const fullAddress = getRequiredField(formData, "fullAddress");
  const complaintDetails = getRequiredField(formData, "complaintDetails");
  const area = getRequiredField(formData, "area");
  const product = getRequiredField(formData, "product");
  const callType = getRequiredField(formData, "callType");
  const { serviceBillingType, chargeableAmount } = getServiceBillingFields(formData, callType);
  const companyKey = getCompanyMatchKey(company);
  const [creator, existingRequestCompany, existingSavedCustomerCompany] = await Promise.all([
    prisma.user.findUnique({
      where: { id: session.userId },
      select: { name: true },
    }),
    prisma.serviceRequest.findFirst({
      where: { company: { equals: company, mode: "insensitive" } },
      select: { id: true },
    }),
    prisma.savedCustomer.findFirst({
      where: { companyKey },
      select: { id: true },
    }),
  ]);
  const isNewSavedCompany = !existingRequestCompany && !existingSavedCustomerCompany;

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
        contactPerson2,
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

    await addServiceActivity(transaction, {
      requestId: created.id,
      type: "created",
      title: "Service Request Created",
      details: `Created docket ${created.docketNumber}`,
      status: created.status,
      actorId: session.userId,
      actorName: creator?.name ?? "Admin / Manager",
      actorRole: getActorRoleLabel(session.role),
      createdAt: created.createdAt,
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
  revalidatePath("/admin");

  const redirectParams = new URLSearchParams({ created: request.docketNumber });
  if (isNewSavedCompany) {
    redirectParams.set("newCompany", "1");
  }

  redirect(`/dashboard?${redirectParams.toString()}`);
}

export async function updateServiceRequestDetails(formData: FormData) {
  await requireRole([APP_ROLES.ADMIN, APP_ROLES.MANAGER]);

  const requestId = getRequiredField(formData, "requestId");
  const name = getRequiredField(formData, "name");
  const company = getRequiredField(formData, "company");
  const contactPerson2 = getOptionalNullableField(formData, "contactPerson2");
  const phoneNumber1 = getRequiredPhoneField(formData, "phoneNumber1", "Phone Number 1");
  const fullAddress = getRequiredField(formData, "fullAddress");
  const complaintDetails = getRequiredField(formData, "complaintDetails");
  const area = getRequiredField(formData, "area");
  const product = getRequiredField(formData, "product");
  const callType = getRequiredField(formData, "callType");
  const { serviceBillingType, chargeableAmount } = getServiceBillingFields(formData, callType);
  const phoneNumber2 = getOptionalPhoneField(formData, "phoneNumber2", "Phone Number 2");
  const installationDate = parseOptionalInstallationDate(getOptionalField(formData, "installationDate"));

  await prisma.serviceRequest.update({
    where: { id: requestId },
    data: {
      name,
      company,
      contactPerson2,
      phoneNumber1,
      phoneNumber2,
      fullAddress,
      installationDate,
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

function normalizeSavedCustomerPhone(value: string) {
  if (value.trim() === "") {
    return null;
  }

  return normalizePhoneNumberForStorage(value);
}

function parseOptionalInstallationDate(value: string) {
  const trimmed = value.trim();

  if (!trimmed) {
    return null;
  }

  const isoDate = /^\d{4}-\d{2}-\d{2}$/.test(trimmed)
    ? new Date(`${trimmed}T00:00:00.000+05:30`)
    : new Date(trimmed);

  if (Number.isNaN(isoDate.getTime())) {
    throw new Error("Installation date must be a valid date.");
  }

  return isoDate;
}

export async function updateSavedCustomerDetails(formData: FormData) {
  await requireRole([APP_ROLES.ADMIN, APP_ROLES.MANAGER]);

  const requestId = getRequiredField(formData, "requestId");
  const source = getOptionalField(formData, "source") || "serviceRequest";
  const company = getRequiredField(formData, "company");
  const name = getRequiredField(formData, "name");
  const phoneNumber1 = getRequiredPhoneField(formData, "phoneNumber1", "Phone Number");
  const area = getRequiredField(formData, "area");
  const fullAddress = getRequiredField(formData, "fullAddress");
  const installationDate = parseOptionalInstallationDate(getOptionalField(formData, "installationDate"));

  if (source === "savedCustomer") {
    await prisma.savedCustomer.update({
      where: { id: requestId },
      data: {
        company,
        companyKey: getCompanyMatchKey(company),
        name,
        phoneNumber1,
        area,
        fullAddress,
        installationDate,
      },
    });
  } else {
    await prisma.serviceRequest.update({
      where: { id: requestId },
      data: {
        company,
        name,
        phoneNumber1,
        area,
        fullAddress,
        installationDate,
      },
    });
  }

  revalidatePath("/admin");
  revalidatePath("/dashboard");
  revalidatePath("/call-history");
  revalidatePath("/report");
}

type SavedCustomerUploadRow = {
  company?: unknown;
  name?: unknown;
  phoneNumber?: unknown;
  area?: unknown;
  fullAddress?: unknown;
  installationDate?: unknown;
};

function getUploadString(value: unknown) {
  if (typeof value === "string") {
    return value.trim();
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value).trim();
  }

  return "";
}

export async function importSavedCustomerDetails(formData: FormData) {
  await requireRole([APP_ROLES.ADMIN, APP_ROLES.MANAGER]);

  let rows: SavedCustomerUploadRow[];
  try {
    rows = await parseSavedCustomerUploadRows(formData);
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "The uploaded file could not be read.",
      updated: 0,
      skipped: 0,
    };
  }

  if (rows.length === 0) {
    return { ok: false, message: "The uploaded file could not be read.", updated: 0, skipped: 0 };
  }

  let updated = 0;
  let created = 0;
  let skipped = 0;
  const [existingRequests, existingSavedCustomers] = await Promise.all([
    prisma.serviceRequest.findMany({
      where: { deletedAt: null },
      orderBy: { createdAt: "asc" },
      select: { id: true, company: true },
    }),
    prisma.savedCustomer.findMany({
      orderBy: { createdAt: "asc" },
      select: { id: true, company: true, companyKey: true },
    }),
  ]);
  const existingCompanyByKey = new Map<string, { id: string; source: "serviceRequest" | "savedCustomer" }>();

  for (const customer of existingRequests) {
    const key = getCompanyMatchKey(customer.company);
    if (key && !existingCompanyByKey.has(key)) {
      existingCompanyByKey.set(key, { id: customer.id, source: "serviceRequest" });
    }
  }

  for (const customer of existingSavedCustomers) {
    const key = customer.companyKey || getCompanyMatchKey(customer.company);
    if (key && !existingCompanyByKey.has(key)) {
      existingCompanyByKey.set(key, { id: customer.id, source: "savedCustomer" });
    }
  }

  for (const row of rows.slice(0, 500)) {
    const company = normalizeCompanyLookup(getUploadString(row.company));
    if (!company) {
      skipped += 1;
      continue;
    }

    const name = getUploadString(row.name);
    const phoneNumberRaw = getUploadString(row.phoneNumber);
    const area = getUploadString(row.area);
    const fullAddress = getUploadString(row.fullAddress);
    const installationDateRaw = getUploadString(row.installationDate);
    const installationDate = installationDateRaw ? parseOptionalInstallationDate(installationDateRaw) : null;
    const phoneNumber1 = phoneNumberRaw ? normalizeSavedCustomerPhone(phoneNumberRaw) : "";

    if (phoneNumberRaw && !phoneNumber1) {
      skipped += 1;
      continue;
    }

    const updateData = {
      name,
      phoneNumber1: phoneNumber1 ?? "",
      area,
      fullAddress,
      ...(installationDateRaw ? { installationDate } : {}),
    };

    const existing = existingCompanyByKey.get(getCompanyMatchKey(company));

    if (existing?.source === "serviceRequest") {
      const serviceRequestUpdateData: Prisma.ServiceRequestUpdateInput = {};
      if (updateData.name) {
        serviceRequestUpdateData.name = updateData.name;
      }
      if (updateData.phoneNumber1) {
        serviceRequestUpdateData.phoneNumber1 = updateData.phoneNumber1;
      }
      if (updateData.area) {
        serviceRequestUpdateData.area = updateData.area;
      }
      if (updateData.fullAddress) {
        serviceRequestUpdateData.fullAddress = updateData.fullAddress;
      }
      if (installationDateRaw) {
        serviceRequestUpdateData.installationDate = installationDate;
      }

      if (Object.keys(serviceRequestUpdateData).length === 0) {
        skipped += 1;
        continue;
      }

      await prisma.serviceRequest.update({
        where: { id: existing.id },
        data: serviceRequestUpdateData,
      });
      updated += 1;
      continue;
    }

    if (existing?.source === "savedCustomer") {
      await prisma.savedCustomer.update({
        where: { id: existing.id },
        data: updateData,
      });
      updated += 1;
      continue;
    }

    const companyKey = getCompanyMatchKey(company);
    const createdCustomer = await prisma.savedCustomer.create({
      data: {
        company,
        companyKey,
        name: updateData.name,
        phoneNumber1: updateData.phoneNumber1,
        area: updateData.area,
        fullAddress: updateData.fullAddress,
        installationDate,
      },
      select: { id: true },
    });
    existingCompanyByKey.set(companyKey, { id: createdCustomer.id, source: "savedCustomer" });
    created += 1;
  }

  revalidatePath("/admin");
  revalidatePath("/dashboard");
  revalidatePath("/call-history");
  revalidatePath("/report");

  return {
    ok: updated > 0 || created > 0,
    message:
      updated > 0 || created > 0
        ? `${updated ? `Updated ${updated}` : ""}${updated && created ? " and " : ""}${created ? `created ${created}` : ""} saved customer record${updated + created === 1 ? "" : "s"}.`
        : "No saved customer records were imported.",
    updated,
    skipped,
  };
}

async function parseSavedCustomerUploadRows(formData: FormData): Promise<SavedCustomerUploadRow[]> {
  const uploadedFile = formData.get("file");

  if (isUploadedFile(uploadedFile) && uploadedFile.size > 0) {
    const fileName = uploadedFile.name.toLowerCase();

    if (fileName.endsWith(".xlsx") || fileName.endsWith(".xls")) {
      const workbookRows = await parseSavedCustomerWorkbook(uploadedFile);
      return mapSavedCustomerRows(workbookRows);
    }

    const text = await uploadedFile.text();
    return mapSavedCustomerRows(parseDelimitedRows(text));
  }

  const rowsRaw = formData.get("rows");
  if (typeof rowsRaw === "string") {
    const parsed = JSON.parse(rowsRaw);
    return Array.isArray(parsed) ? parsed : [];
  }

  return [];
}

function isUploadedFile(value: FormDataEntryValue | null): value is File {
  return (
    typeof value === "object" &&
    value !== null &&
    "arrayBuffer" in value &&
    typeof value.arrayBuffer === "function" &&
    "size" in value
  );
}

async function parseSavedCustomerWorkbook(file: File) {
  const XLSX = await import("xlsx");
  const buffer = Buffer.from(await file.arrayBuffer());
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const firstSheetName = workbook.SheetNames[0];

  if (!firstSheetName) {
    return [];
  }

  const worksheet = workbook.Sheets[firstSheetName];
  return XLSX.utils.sheet_to_json<Array<string | number | boolean | null>>(worksheet, {
    header: 1,
    defval: "",
    raw: false,
  }).map((row) => row.map((cell) => getUploadString(cell)));
}

function mapSavedCustomerRows(rows: string[][]): SavedCustomerUploadRow[] {
  const cleanRows = rows.filter((row) => row.some((cell) => cell.trim() !== ""));
  if (cleanRows.length <= 1) {
    return [];
  }

  const headerRowIndex = findSavedCustomerHeaderRowIndex(cleanRows);
  const header = headerRowIndex >= 0 ? cleanRows[headerRowIndex].map(normalizeSavedCustomerHeader) : [];
  const companyIndex = findSavedCustomerHeaderIndex(header, ["companyname", "company", "customername", "customer"]);
  const nameIndex = findSavedCustomerHeaderIndex(header, ["name", "contactname", "contactperson", "contactperson1", "contact1"]);
  const phoneIndex = findSavedCustomerHeaderIndex(header, ["phonenumber", "phone", "mobile", "contactnumber", "contactno", "contactno1", "phone1", "phonenumber1"]);
  const areaIndex = findSavedCustomerHeaderIndex(header, ["area", "location"]);
  const addressIndex = findSavedCustomerHeaderIndex(header, ["fulladdress", "address"]);
  const installationDateIndex = findSavedCustomerHeaderIndex(header, ["installationdate", "installdate", "dateofinstallation"]);
  const hasKnownHeader = [companyIndex, nameIndex, phoneIndex, areaIndex, addressIndex, installationDateIndex].some((index) => index >= 0);
  const dataRows = hasKnownHeader ? cleanRows.slice(headerRowIndex + 1) : cleanRows;

  return dataRows
    .map((row) => ({
      company: getDelimitedCell(row, hasKnownHeader ? companyIndex : 0),
      name: getDelimitedCell(row, hasKnownHeader ? nameIndex : 1),
      phoneNumber: getDelimitedCell(row, hasKnownHeader ? phoneIndex : 2),
      area: getDelimitedCell(row, hasKnownHeader ? areaIndex : 3),
      fullAddress: getDelimitedCell(row, hasKnownHeader ? addressIndex : 4),
      installationDate: getDelimitedCell(row, hasKnownHeader ? installationDateIndex : 5),
    }))
    .filter((row) => getCompanyMatchKey(row.company) !== "" && !isSavedCustomerMetadataRow(row.company));
}

function normalizeSavedCustomerHeader(value: string) {
  return value.replace(/^\uFEFF/, "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

function findSavedCustomerHeaderRowIndex(rows: string[][]) {
  return rows.findIndex((row) => {
    const normalizedCells = row.map(normalizeSavedCustomerHeader);
    const hasCustomerName = normalizedCells.some((cell) => ["customername", "companyname", "company"].includes(cell));
    const hasContactOrPhone = normalizedCells.some((cell) =>
      ["contactperson1", "contactperson", "contactno1", "contactno", "phonenumber", "phone"].includes(cell),
    );
    const hasAddress = normalizedCells.some((cell) => ["address", "fulladdress"].includes(cell));

    return hasCustomerName && (hasContactOrPhone || hasAddress);
  });
}

function findSavedCustomerHeaderIndex(headers: string[], names: string[]) {
  return headers.findIndex((header) => names.includes(header));
}

function getDelimitedCell(row: string[], index: number) {
  return index >= 0 ? row[index]?.trim() ?? "" : "";
}

function normalizeCompanyLookup(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function getCompanyMatchKey(value: string) {
  return normalizeCompanyLookup(value).toLowerCase().replace(/[^a-z0-9]/g, "");
}

function isSavedCustomerMetadataRow(value: string) {
  const key = getCompanyMatchKey(value);
  return ["listofaccounts", "groupsundrydebtors", "customername"].includes(key);
}

function parseDelimitedRows(content: string) {
  const delimiter = detectDelimiter(content);
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;

  for (let index = 0; index < content.length; index += 1) {
    const char = content[index];
    const nextChar = content[index + 1];

    if (char === '"' && inQuotes && nextChar === '"') {
      cell += '"';
      index += 1;
      continue;
    }

    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (char === delimiter && !inQuotes) {
      row.push(cell.trim());
      cell = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && nextChar === "\n") {
        index += 1;
      }
      row.push(cell.trim());
      rows.push(row);
      row = [];
      cell = "";
      continue;
    }

    cell += char;
  }

  row.push(cell.trim());
  rows.push(row);
  return rows;
}

function detectDelimiter(content: string) {
  const headerLine = content.split(/\r?\n/, 1)[0] ?? "";
  const candidates = [",", "\t", ";"] as const;

  return candidates.reduce((best, candidate) => {
    const bestCount = headerLine.split(best).length;
    const candidateCount = headerLine.split(candidate).length;
    return candidateCount > bestCount ? candidate : best;
  }, "," as "," | "\t" | ";");
}

export async function deleteServiceRequest(formData: FormData) {
  const session = await requireRole([APP_ROLES.ADMIN, APP_ROLES.MANAGER]);

  const requestId = getRequiredField(formData, "requestId");
  const deletedAt = new Date();
  const actor = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { name: true },
  });
  const actorName = actor?.name || "Admin / Manager";
  const actorRole = getActorRoleLabel(session.role);

  await prisma.$transaction(async (transaction) => {
    const request = await transaction.serviceRequest.update({
      where: { id: requestId },
      data: {
        assignedToId: null,
        assignedAt: null,
        deletedAt,
        deletedById: session.userId,
        deletedByName: actorName,
        deletedByRole: actorRole,
      },
      select: {
        docketNumber: true,
      },
    });

    await addServiceActivity(transaction, {
      requestId,
      type: "deleted",
      title: "Service Request Deleted",
      details: `${actorName} deleted docket ${request.docketNumber}`,
      actorId: session.userId,
      actorName,
      actorRole,
      createdAt: deletedAt,
    });

    await transaction.serviceAssignment.deleteMany({
      where: { requestId },
    });
  });

  revalidatePath("/dashboard");
  revalidatePath("/form");
  revalidatePath("/call-history");
  revalidatePath("/report");
}

export async function addStaff(formData: FormData) {
  await requireRole([APP_ROLES.ADMIN]);

  const name = getRequiredField(formData, "name");
  const username = getRequiredField(formData, "username");
  const password = getRequiredField(formData, "password");
  const role = getRequiredField(formData, "role");
  let phoneNumber1: string | null;
  let phoneNumber2: string | null;

  try {
    phoneNumber1 = getOptionalPhoneField(formData, "phoneNumber1", "Phone Number 1");
    phoneNumber2 = getOptionalPhoneField(formData, "phoneNumber2", "Phone Number 2");
  } catch (error) {
    if (isPhoneValidationError(error)) {
      redirect("/admin?tab=staff&phoneError=1");
    }

    throw error;
  }

  const department = getStaffDepartment(formData);

  if (role !== APP_ROLES.MANAGER && role !== APP_ROLES.EMPLOYEE) {
    throw new Error("Invalid role selected");
  }

  await prisma.user.create({
    data: {
      name,
      username,
      password,
      whatsappNumber: phoneNumber1,
      phoneNumber1,
      phoneNumber2,
      department,
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
  let phoneNumber1: string | null;
  let phoneNumber2: string | null;

  try {
    phoneNumber1 = getOptionalPhoneField(formData, "phoneNumber1", "Phone Number 1");
    phoneNumber2 = getOptionalPhoneField(formData, "phoneNumber2", "Phone Number 2");
  } catch (error) {
    if (isPhoneValidationError(error)) {
      redirect("/admin?tab=staff&phoneError=1");
    }

    throw error;
  }

  const department = getStaffDepartment(formData);

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
    whatsappNumber: phoneNumber1,
    phoneNumber1,
    phoneNumber2,
    department,
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
      statusSubmittedAt: true,
      lastAttemptAt: true,
      closedAt: true,
      deletedAt: true,
    },
  });

  if (!previousRequest || previousRequest.deletedAt) {
    redirect("/dashboard");
  }

  const isCompletedRequest = normalizeStatus(previousRequest.status) === "Completed";
  if (isCompletedRequest && !isCompletedReassignWindowOpen(getCompletedAtForReassign(previousRequest))) {
    throw new Error("Reassign window closed after 72 hours.");
  }

  const shouldReopenForQueue =
    assignedToId !== null &&
    !!previousRequest &&
    (assignedToId !== previousRequest.assignedToId || normalizeStatus(previousRequest.status) !== "New Call");

  const allocationChanged = assignedToId !== previousRequest?.assignedToId;
  const assignedAt = new Date();
  const [actor, assignee] = await Promise.all([
    prisma.user.findUnique({
      where: { id: session.userId },
      select: { name: true },
    }),
    assignedToId
      ? prisma.user.findUnique({
          where: { id: assignedToId },
          select: { name: true, role: true, whatsappNumber: true },
        })
      : Promise.resolve(null),
  ]);

  await prisma.$transaction(async (transaction) => {
    await transaction.serviceRequest.update({
      where: { id: requestId },
      data: {
        assignedToId,
        assignedAt:
          assignedToId === null
            ? null
            : shouldReopenForQueue || allocationChanged
              ? assignedAt
              : undefined,
        ...(isCompletedRequest && assignedToId
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

    if (allocationChanged || shouldReopenForQueue) {
      await addServiceActivity(transaction, {
        requestId,
        type: assignedToId ? "assigned" : "unassigned",
        title: assignedToId ? "Service Request Assigned" : "Service Request Unassigned",
        details: assignedToId
          ? `Assigned to ${assignee?.name ?? "Employee"}`
          : "Assignment removed",
        status: assignedToId && isCompletedRequest ? "New Call" : previousRequest.status,
        actorId: session.userId,
        actorName: actor?.name ?? "Admin / Manager",
        actorRole: getActorRoleLabel(session.role),
        employeeId: assignedToId,
        employeeName: assignee?.name ?? null,
        createdAt: assignedAt,
      });
    }
  });

  const shouldNotify =
    !!previousRequest &&
    assignedToId !== null &&
    assignedToId !== previousRequest.assignedToId;

  if (shouldNotify) {
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
  const status = getDashboardStatus(getRequiredField(formData, "status"));
  const statusReason = formData.get("statusReason");
  const reasonValue = typeof statusReason === "string" ? statusReason.trim() : "";

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
        mediaUploadedAt: null,
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

  if (status === "New Call") {
    throw new Error("Please choose a status other than New Call.");
  }

  if (status === "Completed" && reasonValue === "") {
    throw new Error("Remark is required when status is Completed.");
  }

  const employee = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { name: true },
  });

  const submittedAt = new Date();
  const firstStatusPointsDelta = getStatusSubmissionPoints(assignment.assignedAt ?? assignment.request.createdAt, submittedAt);
  const employeeName = employee?.name || "Unknown";

  await prisma.$transaction(async (transaction) => {
    const shouldAwardPoints =
      !alreadyUpdatedForCurrentAllocation &&
      (await shouldAwardStatusSubmissionPoints({
        transaction,
        employeeId: session.userId,
        employeeName,
        assignedAt: assignment.assignedAt ?? assignment.request.createdAt,
      }));
    const statusPointsDelta = alreadyUpdatedForCurrentAllocation
      ? assignment.statusPointsDelta
      : shouldAwardPoints
        ? firstStatusPointsDelta
        : null;
    const performancePointsIncrement = shouldAwardPoints ? firstStatusPointsDelta : 0;

    await transaction.serviceAssignment.update({
      where: { id: assignment.id },
      data: {
        status,
        statusReason: reasonValue || null,
        statusSubmittedAt: submittedAt,
        statusPointsDelta,
        closedByName: status === "Completed" ? employeeName : null,
        closedAt: status === "Completed" ? submittedAt : null,
      },
    });

    const updatedAssignments = await transaction.serviceAssignment.findMany({
      where: { requestId },
      orderBy: { assignedAt: "asc" },
      include: { employee: { select: { name: true } } },
    });
    const aggregateStatus = getAggregateAssignmentStatus(updatedAssignments);
    const latestAssignment = getLatestSubmittedAssignment(updatedAssignments);
    const primaryOpenAssignment = getPrimaryOpenAssignment(updatedAssignments);
    const completedAssignment =
      aggregateStatus === "Completed"
        ? updatedAssignments
            .filter((updatedAssignment) => normalizeStatus(updatedAssignment.status) === "Completed")
            .sort((a, b) => (b.closedAt?.getTime() ?? 0) - (a.closedAt?.getTime() ?? 0))[0] ?? latestAssignment
        : null;

    await transaction.serviceRequest.update({
      where: { id: requestId },
      data: {
        assignedToId:
          aggregateStatus === "Completed" || aggregateStatus === "Cancel"
            ? null
            : primaryOpenAssignment?.employeeId ?? null,
        assignedAt:
          aggregateStatus === "Completed" || aggregateStatus === "Cancel"
            ? null
            : primaryOpenAssignment?.assignedAt ?? null,
        status: aggregateStatus,
        statusReason: (latestAssignment?.statusReason ?? reasonValue) || null,
        customerReview: null,
        statusSubmittedAt: latestAssignment?.statusSubmittedAt ?? submittedAt,
        statusPointsDelta: latestAssignment?.statusPointsDelta ?? null,
        reviewPointsDelta: null,
        lastAttemptByName: latestAssignment?.employee?.name ?? employeeName,
        lastAttemptAt: latestAssignment?.statusSubmittedAt ?? submittedAt,
        closedByName: completedAssignment?.employee?.name ?? null,
        closedAt: completedAssignment?.closedAt ?? null,
      },
    });

    await addServiceActivity(transaction, {
      requestId,
      type: status === "Completed" ? "completed" : "status",
      title: status === "Completed" ? "Service Request Completed" : "Status Updated",
      details: `${employeeName} marked this call as ${status}${reasonValue ? `: ${reasonValue}` : ""}`,
      status,
      statusReason: reasonValue || null,
      actorId: session.userId,
      actorName: employeeName,
      actorRole: getActorRoleLabel(session.role),
      employeeId: session.userId,
      employeeName,
      createdAt: submittedAt,
    });

    if (performancePointsIncrement !== 0) {
      await transaction.user.update({
        where: { id: session.userId },
        data: {
          performancePoints: {
            increment: performancePointsIncrement,
          },
        },
      });
    }
  });

  revalidatePath("/dashboard");
}

export async function updateManagerServiceStatus(formData: FormData) {
  const session = await requireSession();

  if (!roleCanAssign(session.role)) {
    redirect("/dashboard");
  }

  const requestId = getRequiredField(formData, "requestId");
  const status = getDashboardStatus(getRequiredField(formData, "status"));
  const statusReason = formData.get("statusReason");
  const reasonValue = typeof statusReason === "string" ? statusReason.trim() : "";
  const submittedAt = status === "New Call" ? null : new Date();
  const closedAt = status === "Completed" ? submittedAt : null;

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { name: true },
  });
  const closedByName = status === "Completed" ? user?.name || "Admin / Manager" : null;

  await prisma.$transaction(async (transaction) => {
    await transaction.serviceRequest.update({
      where: { id: requestId },
      data: {
        assignedToId: null,
        assignedAt: null,
        status,
        statusReason: reasonValue || null,
        statusSubmittedAt: submittedAt,
        customerReview: null,
        reviewPointsDelta: null,
        closedByName,
        closedAt,
      },
    });

    await addServiceActivity(transaction, {
      requestId,
      type: status === "Completed" ? "completed" : "manager-status",
      title: status === "Completed" ? "Service Request Completed" : "Status Updated by Admin / Manager",
      details: `${user?.name || "Admin / Manager"} changed status to ${status}${reasonValue ? `: ${reasonValue}` : ""}`,
      status,
      statusReason: reasonValue || null,
      actorId: session.userId,
      actorName: user?.name || "Admin / Manager",
      actorRole: getActorRoleLabel(session.role),
      createdAt: submittedAt ?? new Date(),
    });

    await transaction.serviceAssignment.deleteMany({
      where: { requestId },
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
  const attendanceInRaw = getOptionalField(formData, "attendanceInOption");
  const attendanceOutRaw = getOptionalField(formData, "attendanceOutOption");
  const reviewRaw = getOptionalField(formData, "reviewOption");
  const documentSubmissionRaw = getOptionalField(formData, "documentSubmissionOption");
  const materialHandoverRaw = getOptionalField(formData, "materialHandoverOption");
  const adjustmentDate = parsePerformanceAdjustmentDate(getRequiredField(formData, "adjustmentDate"));

  if (attendanceInRaw && !isAttendanceInOption(attendanceInRaw)) {
    throw new Error("Invalid attendance IN option");
  }

  if (attendanceOutRaw && !isAttendanceOutOption(attendanceOutRaw)) {
    throw new Error("Invalid attendance OUT option");
  }

  if (reviewRaw && !isReviewOption(reviewRaw)) {
    throw new Error("Invalid review option");
  }

  if (documentSubmissionRaw && !isDocumentSubmissionOption(documentSubmissionRaw)) {
    throw new Error("Invalid document submission option");
  }

  if (materialHandoverRaw && !isMaterialHandoverOption(materialHandoverRaw)) {
    throw new Error("Invalid material handover option");
  }

  const attendanceIn = attendanceInRaw && isAttendanceInOption(attendanceInRaw) ? ATTENDANCE_IN_POINTS[attendanceInRaw] : null;
  const attendanceOut = attendanceOutRaw && isAttendanceOutOption(attendanceOutRaw) ? ATTENDANCE_OUT_POINTS[attendanceOutRaw] : null;
  const review = reviewRaw && isReviewOption(reviewRaw) ? REVIEW_POINTS[reviewRaw] : null;
  const documentSubmission =
    documentSubmissionRaw && isDocumentSubmissionOption(documentSubmissionRaw)
      ? DOCUMENT_SUBMISSION_POINTS[documentSubmissionRaw]
      : null;
  const materialHandover =
    materialHandoverRaw && isMaterialHandoverOption(materialHandoverRaw)
      ? MATERIAL_HANDOVER_POINTS[materialHandoverRaw]
      : null;
  const attendancePoints = (attendanceIn?.points ?? 0) + (attendanceOut?.points ?? 0);
  const totalDelta =
    attendancePoints +
    (review?.points ?? 0) +
    (documentSubmission?.points ?? 0) +
    (materialHandover?.points ?? 0);
  const adjustmentDateRange = getPerformanceAdjustmentDateRange(adjustmentDate);

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

      let previousDayDelta = 0;

      try {
        const existingAdjustments = await transaction.employeePointAdjustment.findMany({
          where: {
            employeeId,
            createdAt: {
              gte: adjustmentDateRange.startAt,
              lt: adjustmentDateRange.endAt,
            },
          },
          select: {
            id: true,
            totalDelta: true,
          },
          orderBy: { createdAt: "desc" },
        });

        previousDayDelta = existingAdjustments.reduce((total, adjustment) => total + adjustment.totalDelta, 0);

        const existingAdjustment = existingAdjustments[0] ?? null;
        const adjustmentData = {
          employeeId,
          updatedById: session.userId,
          attendanceOption: JSON.stringify({ inOption: attendanceInRaw, outOption: attendanceOutRaw }),
          attendancePoints,
          reviewOption: reviewRaw,
          reviewPoints: review?.points ?? 0,
          documentSubmissionOption: documentSubmissionRaw,
          documentSubmissionPoints: documentSubmission?.points ?? 0,
          materialHandoverOption: materialHandoverRaw,
          materialHandoverPoints: materialHandover?.points ?? 0,
          teamworkOption: "N/A",
          teamworkPoints: 0,
          totalDelta,
          createdAt: adjustmentDate,
        };

        if (existingAdjustment) {
          await transaction.employeePointAdjustment.update({
            where: { id: existingAdjustment.id },
            data: adjustmentData,
          });

          const duplicateAdjustmentIds = existingAdjustments.slice(1).map((adjustment) => adjustment.id);

          if (duplicateAdjustmentIds.length > 0) {
            await transaction.employeePointAdjustment.deleteMany({
              where: {
                id: { in: duplicateAdjustmentIds },
              },
            });
          }
        } else {
          await transaction.employeePointAdjustment.create({
            data: adjustmentData,
          });
        }
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

      const pointsDelta = totalDelta - previousDayDelta;

      if (pointsDelta !== 0) {
        await transaction.user.update({
          where: { id: employeeId },
          data: {
            performancePoints: {
              increment: pointsDelta,
            },
            ...(isCurrentPerformanceMonth(adjustmentDate)
              ? {
                  monthlyPerformancePoints: {
                    increment: pointsDelta,
                  },
                }
              : {}),
          },
        });
      }

      if (pointsDelta !== 0 && !isCurrentPerformanceMonth(adjustmentDate)) {
        const adjustmentParts = getLocalDateTimeParts(adjustmentDate, PERFORMANCE_TIME_ZONE);
        await transaction.monthlyPerformanceHistory.upsert({
          where: {
            employeeId_year_month: {
              employeeId,
              year: adjustmentParts.year,
              month: adjustmentParts.month,
            },
          },
          update: {
            totalPoints: {
              increment: pointsDelta,
            },
          },
          create: {
            employeeId,
            year: adjustmentParts.year,
            month: adjustmentParts.month,
            totalPoints: pointsDelta,
          },
        });
      }
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

const TECH_MANUAL_CATEGORIES = ["safety", "security", "automation"] as const;

function getTechManualCategory(value: string) {
  const normalized = value.trim().toLowerCase();

  if (TECH_MANUAL_CATEGORIES.includes(normalized as (typeof TECH_MANUAL_CATEGORIES)[number])) {
    return normalized;
  }

  throw new Error("Invalid tech manual category.");
}

function getTechManualDocumentType(fileName: string) {
  const extension = fileName.split(".").pop()?.toLowerCase() ?? "";

  if (["png", "jpeg", "jpg", "webp", "gif"].includes(extension)) {
    return "image";
  }

  if (["mp4", "m4v", "webm", "mov", "qt", "ogv", "avi", "mkv", "3gp", "wmv"].includes(extension)) {
    return "video";
  }

  if (extension === "pdf") {
    return "pdf";
  }

  if (["doc", "docx", "rtf"].includes(extension)) {
    return "word";
  }

  throw new Error("Unsupported manual document type.");
}

function getTechManualCategoryPath(category: string) {
  return `/tech-manual/${category}`;
}

async function getTechManualActor(userId: string) {
  return prisma.user.findUnique({
    where: { id: userId },
    select: { name: true },
  });
}

export async function createTechManualFolder(formData: FormData) {
  const session = await requireRole([APP_ROLES.ADMIN, APP_ROLES.MANAGER]);
  const category = getTechManualCategory(getRequiredField(formData, "category"));
  const name = getRequiredField(formData, "name");
  const actor = await getTechManualActor(session.userId);

  await prisma.techManualFolder.create({
    data: {
      category,
      name,
      createdById: session.userId,
      createdByName: actor?.name ?? "Admin / Manager",
    },
  });

  revalidatePath(getTechManualCategoryPath(category));
}

export async function uploadTechManualDocument(formData: FormData) {
  const session = await requireRole([APP_ROLES.ADMIN, APP_ROLES.MANAGER]);
  const folderId = getRequiredField(formData, "folderId");
  const documentName = getRequiredField(formData, "documentName");
  const file = formData.get("file");

  if (!file || typeof file === "string" || file.size === 0 || !file.name) {
    throw new Error("Please select a valid document file.");
  }

  const folder = await prisma.techManualFolder.findUnique({
    where: { id: folderId },
    select: { id: true, category: true },
  });

  if (!folder) {
    throw new Error("Tech manual folder not found.");
  }

  const documentType = getTechManualDocumentType(file.name);
  const path = await import("path");
  const fs = await import("fs");
  const buffer = Buffer.from(await file.arrayBuffer());
  const uploadsBase = path.join(process.cwd(), "public", "manual-uploads");
  const folderPath = path.join(uploadsBase, folder.id);

  await fs.promises.mkdir(folderPath, { recursive: true });

  const safeName = `${Date.now()}-${sanitizeFileName(file.name)}`;
  const filePath = path.join(folderPath, safeName);
  await fs.promises.writeFile(filePath, buffer);

  const actor = await getTechManualActor(session.userId);
  await prisma.techManualDocument.create({
    data: {
      folderId: folder.id,
      name: documentName,
      documentType,
      fileName: file.name,
      fileUrl: `/manual-uploads/${encodeURIComponent(folder.id)}/${encodeURIComponent(safeName)}`,
      uploadedById: session.userId,
      uploadedByName: actor?.name ?? "Admin / Manager",
    },
  });

  revalidatePath(getTechManualCategoryPath(folder.category));
}

export async function addTechManualYoutubeLink(formData: FormData) {
  const session = await requireRole([APP_ROLES.ADMIN, APP_ROLES.MANAGER]);
  const folderId = getRequiredField(formData, "folderId");
  const documentName = getRequiredField(formData, "documentName");
  const youtubeUrl = getRequiredField(formData, "youtubeUrl");

  if (!/^https?:\/\/(www\.)?(youtube\.com|youtu\.be)\//i.test(youtubeUrl)) {
    throw new Error("Please enter a valid YouTube link.");
  }

  const folder = await prisma.techManualFolder.findUnique({
    where: { id: folderId },
    select: { id: true, category: true },
  });

  if (!folder) {
    throw new Error("Tech manual folder not found.");
  }

  const actor = await getTechManualActor(session.userId);
  await prisma.techManualDocument.create({
    data: {
      folderId: folder.id,
      name: documentName,
      documentType: "youtube",
      youtubeUrl,
      uploadedById: session.userId,
      uploadedByName: actor?.name ?? "Admin / Manager",
    },
  });

  revalidatePath(getTechManualCategoryPath(folder.category));
}

export async function deleteTechManualDocument(formData: FormData) {
  await requireRole([APP_ROLES.ADMIN, APP_ROLES.MANAGER]);
  const documentId = getRequiredField(formData, "documentId");

  const document = await prisma.techManualDocument.findUnique({
    where: { id: documentId },
    include: { folder: { select: { category: true } } },
  });

  if (!document) {
    return;
  }

  if (document.fileUrl) {
    const path = await import("path");
    const fs = await import("fs");
    const uploadsBase = path.resolve(process.cwd(), "public", "manual-uploads");
    const urlParts = document.fileUrl.split("/").filter(Boolean);

    if (urlParts.length === 3 && urlParts[0] === "manual-uploads") {
      const folderId = decodeURIComponent(urlParts[1]);
      const fileName = decodeURIComponent(urlParts[2]);
      const filePath = path.resolve(uploadsBase, folderId, fileName);
      const uploadsRootPrefix = `${uploadsBase}${path.sep}`;

      if (filePath.startsWith(uploadsRootPrefix)) {
        await fs.promises.unlink(filePath).catch(() => undefined);
      }
    }
  }

  await prisma.techManualDocument.delete({ where: { id: document.id } });
  revalidatePath(getTechManualCategoryPath(document.folder.category));
}

export async function deleteTechManualFolder(formData: FormData) {
  await requireRole([APP_ROLES.ADMIN, APP_ROLES.MANAGER]);
  const folderId = getRequiredField(formData, "folderId");

  const folder = await prisma.techManualFolder.findUnique({
    where: { id: folderId },
    select: { id: true, category: true },
  });

  if (!folder) {
    return;
  }

  await prisma.techManualFolder.delete({ where: { id: folder.id } });

  const path = await import("path");
  const fs = await import("fs");
  const folderPath = path.resolve(process.cwd(), "public", "manual-uploads", folder.id);
  await fs.promises.rm(folderPath, { recursive: true, force: true }).catch(() => undefined);

  revalidatePath(getTechManualCategoryPath(folder.category));
}

export async function uploadEmployeeImage(formData: FormData) {
  const session = await requireSession();

  // Only employees may upload images for their gallery
  if (session.role !== APP_ROLES.EMPLOYEE) {
    redirect("/dashboard");
  }

  const requestId = getRequiredField(formData, "requestId");
  const file = formData.get("file") as File | null;
  if (!file || typeof file === "string" || file.size === 0 || !file.name) {
    throw new Error("Please select a valid image or video file.");
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

  const uploadsBase =
    shouldUseTmpUploads()
      ? path.join(os.tmpdir(), "srs-uploads")
      : path.join(process.cwd(), "public", "uploads");

  const requestDir = path.join(uploadsBase, session.userId, requestId);

  await fs.promises.mkdir(requestDir, { recursive: true });

  const timestamp = Date.now();
  const safeName = `${timestamp}-${sanitizeFileName(file.name)}`;
  const filePath = path.join(requestDir, safeName);

  await fs.promises.writeFile(filePath, buffer);

  try {
    await prisma.serviceAssignment.update({
      where: {
        requestId_employeeId: {
          requestId,
          employeeId: session.userId,
        },
      },
      data: {
        mediaUploadedAt: new Date(),
      },
    });
  } catch (error) {
    const code = (error as { code?: string } | null)?.code;
    if (code === "P2025") {
      throw new Error("This call is no longer assigned to you.");
    }

    throw error;
  }

  revalidatePath("/dashboard");
  return { success: true, fileName: safeName };
}

export async function deleteGalleryMedia(formData: FormData) {
  const session = await requireSession();

  if (!roleCanAssign(session.role)) {
    redirect("/dashboard");
  }

  const fileUrl = getRequiredField(formData, "fileUrl");
  const fs = await import("fs");
  const path = await import("path");

  const uploadsBase = path.resolve(process.cwd(), "public", "uploads");
  const urlParts = fileUrl.split("/").filter(Boolean);

  if (urlParts.length !== 4 || urlParts[0] !== "uploads") {
    throw new Error("Invalid gallery file");
  }

  const userId = decodeURIComponent(urlParts[1]);
  const requestId = decodeURIComponent(urlParts[2]);
  const fileName = decodeURIComponent(urlParts[3]);
  const requestDir = path.resolve(uploadsBase, userId, requestId);
  const filePath = path.resolve(requestDir, fileName);
  const uploadsRootPrefix = `${uploadsBase}${path.sep}`;

  if (!filePath.startsWith(uploadsRootPrefix)) {
    throw new Error("Invalid gallery file");
  }

  const stat = await fs.promises.stat(filePath).catch(() => null);

  if (!stat?.isFile()) {
    throw new Error("Gallery file not found");
  }

  await fs.promises.unlink(filePath);

  const remainingFiles = await fs.promises.readdir(requestDir, { withFileTypes: true }).catch(() => []);
  const hasRemainingMedia = remainingFiles.some((file) => {
    if (!file.isFile()) {
      return false;
    }

    return isGalleryMediaFile(file.name);
  });

  if (!hasRemainingMedia) {
    await prisma.serviceAssignment.updateMany({
      where: {
        requestId,
        employeeId: userId,
      },
      data: {
        mediaUploadedAt: null,
      },
    });
  }

  await fs.promises.rmdir(requestDir).catch(() => undefined);
  await fs.promises.rmdir(path.resolve(uploadsBase, userId)).catch(() => undefined);

  revalidatePath("/gallery");
  revalidatePath("/dashboard");
}

function sanitizeFileName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, "-").slice(0, 200);
}

function isGalleryMediaFile(name: string) {
  const extension = name.split(".").pop()?.toLowerCase() ?? "";
  return ["png", "jpeg", "jpg", "webp", "gif", "mp4", "m4v", "webm", "mov", "qt", "ogv", "avi", "mkv", "3gp", "wmv"].includes(extension);
}
