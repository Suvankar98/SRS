"use server";

import type { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getSession, roleCanAssign } from "@/lib/auth";

import { prisma } from "@/lib/prisma";
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
import { encodeTaskReviewNote, decodeTaskReviewNote } from "@/lib/employee-review-notes";

const TIME_ZONE = "Asia/Kolkata";

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

function parseDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error("Invalid adjustment date");
  }
  const date = new Date(`${value}T12:00:00.000+05:30`);
  if (Number.isNaN(date.getTime())) {
    throw new Error("Invalid adjustment date");
  }
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  if (value > today) {
    throw new Error("Adjustment date cannot be in the future");
  }
  return date;
}

function getDateRange(value: Date) {
  const dateKey = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(value);
  return {
    startAt: new Date(`${dateKey}T00:00:00.000+05:30`),
    endAt: new Date(`${dateKey}T00:00:00.000+05:30`).getTime() + 24 * 60 * 60 * 1000,
  };
}

function isCurrentMonth(value: Date) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
  });
  return formatter.format(value) === formatter.format(new Date());
}

async function applyPointDelta(
  transaction: Prisma.TransactionClient,
  employeeId: string,
  pointsDelta: number,
  performanceDate: Date,
) {
  if (pointsDelta === 0) return;

  const employee = await transaction.user.findUnique({
    where: { id: employeeId },
    select: { monthlyPerformancePoints: true, lastMonthlyResetDate: true },
  });
  if (!employee) throw new Error("Employee not found");

  const now = new Date();
  const resetDate = employee.lastMonthlyResetDate;
  const formatter = new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE, year: "numeric", month: "2-digit" });
  const needsReset = !resetDate || formatter.format(resetDate) !== formatter.format(now);

  let monthlyPoints = employee.monthlyPerformancePoints;
  if (needsReset) {
    if (resetDate) {
      const resetParts = new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE, year: "numeric", month: "2-digit" }).formatToParts(resetDate);
      const year = Number(resetParts.find((part) => part.type === "year")?.value);
      const month = Number(resetParts.find((part) => part.type === "month")?.value);
      if (year && month) {
        await transaction.monthlyPerformanceHistory.upsert({
          where: { employeeId_year_month: { employeeId, year, month } },
          update: { totalPoints: { increment: monthlyPoints } },
          create: { employeeId, year, month, totalPoints: monthlyPoints },
        });
      }
    }
    monthlyPoints = 0;
  }

  const currentMonthDelta = isCurrentMonth(performanceDate) ? pointsDelta : 0;
  await transaction.user.update({
    where: { id: employeeId },
    data: {
      performancePoints: { increment: pointsDelta },
      monthlyPerformancePoints: needsReset
        ? monthlyPoints + currentMonthDelta
        : { increment: currentMonthDelta },
      ...(needsReset ? { lastMonthlyResetDate: now } : {}),
    },
  });

  if (!isCurrentMonth(performanceDate)) {
    const parts = new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE, year: "numeric", month: "2-digit" }).formatToParts(performanceDate);
    const year = Number(parts.find((part) => part.type === "year")?.value);
    const month = Number(parts.find((part) => part.type === "month")?.value);
    if (year && month) {
      await transaction.monthlyPerformanceHistory.upsert({
        where: { employeeId_year_month: { employeeId, year, month } },
        update: { totalPoints: { increment: pointsDelta } },
        create: { employeeId, year, month, totalPoints: pointsDelta },
      });
    }
  }
}

export async function saveEmployeePerformanceTag(formData: FormData) {
  const session = await getSession();
  if (!session || !roleCanAssign(session.role)) redirect("/dashboard");

  const employeeId = getRequiredField(formData, "employeeId");
  const assignmentId = getRequiredField(formData, "assignmentId");
  const adjustmentDate = parseDate(getRequiredField(formData, "adjustmentDate"));
  const attendanceInRaw = getOptionalField(formData, "attendanceInOption");
  const attendanceOutRaw = getOptionalField(formData, "attendanceOutOption");
  const reviewRaw = getOptionalField(formData, "reviewOption");
  const reviewNote = getOptionalField(formData, "reviewNote").slice(0, 1000);
  const documentSubmissionRaw = getOptionalField(formData, "documentSubmissionOption");
  const materialHandoverRaw = getOptionalField(formData, "materialHandoverOption");

  if (attendanceInRaw && !isAttendanceInOption(attendanceInRaw)) throw new Error("Invalid attendance IN option");
  if (attendanceOutRaw && !isAttendanceOutOption(attendanceOutRaw)) throw new Error("Invalid attendance OUT option");
  if (reviewRaw && !isReviewOption(reviewRaw)) throw new Error("Invalid review option");
  if (documentSubmissionRaw && !isDocumentSubmissionOption(documentSubmissionRaw)) throw new Error("Invalid document submission option");
  if (materialHandoverRaw && !isMaterialHandoverOption(materialHandoverRaw)) throw new Error("Invalid material handover option");

  const adjustmentDateRange = getDateRange(adjustmentDate);

  await prisma.$transaction(async (transaction) => {
    const assignment = await transaction.serviceAssignment.findUnique({
      where: { id: assignmentId },
      select: { id: true, requestId: true, employeeId: true, assignedAt: true, request: { select: { deletedAt: true } } },
    });

    if (!assignment || assignment.employeeId !== employeeId || assignment.request.deletedAt) {
      throw new Error("The selected task is not assigned to this employee.");
    }

    if (
      assignment.assignedAt < adjustmentDateRange.startAt ||
      assignment.assignedAt >= new Date(adjustmentDateRange.endAt)
    ) {
      throw new Error("The selected task was not assigned on the selected date.");
    }

    const attendanceIn = attendanceInRaw && isAttendanceInOption(attendanceInRaw) ? ATTENDANCE_IN_POINTS[attendanceInRaw] : null;
    const attendanceOut = attendanceOutRaw && isAttendanceOutOption(attendanceOutRaw) ? ATTENDANCE_OUT_POINTS[attendanceOutRaw] : null;
    const review = reviewRaw && isReviewOption(reviewRaw) ? REVIEW_POINTS[reviewRaw] : null;
    const documentSubmission = documentSubmissionRaw && isDocumentSubmissionOption(documentSubmissionRaw) ? DOCUMENT_SUBMISSION_POINTS[documentSubmissionRaw] : null;
    const materialHandover = materialHandoverRaw && isMaterialHandoverOption(materialHandoverRaw) ? MATERIAL_HANDOVER_POINTS[materialHandoverRaw] : null;
    const attendancePoints = (attendanceIn?.points ?? 0) + (attendanceOut?.points ?? 0);
    const totalDelta = attendancePoints + (review?.points ?? 0) + (documentSubmission?.points ?? 0) + (materialHandover?.points ?? 0);
    const encodedNote = encodeTaskReviewNote({
      assignmentId,
      requestId: assignment.requestId,
      note: reviewNote,
    });

    const adjustments = await transaction.employeePointAdjustment.findMany({
      where: { employeeId, createdAt: { gte: adjustmentDateRange.startAt, lt: new Date(adjustmentDateRange.endAt) } },
      select: { id: true, totalDelta: true, teamworkOption: true },
      orderBy: { createdAt: "desc" },
    });
    const existing =
      adjustments.find((item) => decodeTaskReviewNote(item.teamworkOption)?.assignmentId === assignmentId) ??
      adjustments.find((item) => !decodeTaskReviewNote(item.teamworkOption)?.assignmentId) ??
      null;
    const previousDelta = existing?.totalDelta ?? 0;

    const data = {
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
      teamworkOption: encodedNote,
      teamworkPoints: 0,
      totalDelta,
      createdAt: adjustmentDate,
    };

    if (existing) {
      await transaction.employeePointAdjustment.update({ where: { id: existing.id }, data });
    } else {
      await transaction.employeePointAdjustment.create({ data });
    }

    await applyPointDelta(transaction, employeeId, totalDelta - previousDelta, adjustmentDate);
  });

  revalidatePath("/report");
  revalidatePath("/dashboard");
}

type PerformanceReviewEntry = {
  assignmentId: string;
  reviewNote: string;
};

export async function saveEmployeeDailyPerformance(formData: FormData) {
  const session = await getSession();
  if (!session || !roleCanAssign(session.role)) redirect("/dashboard");

  const employeeId = getRequiredField(formData, "employeeId");
  const date = parseDate(getRequiredField(formData, "adjustmentDate"));
  const inOption = getOptionalField(formData, "attendanceInOption");
  const outOption = getOptionalField(formData, "attendanceOutOption");
  const documentOption = getOptionalField(formData, "documentSubmissionOption");
  const materialOption = getOptionalField(formData, "materialHandoverOption");
  if (inOption && !isAttendanceInOption(inOption)) throw new Error("Invalid attendance IN option");
  if (outOption && !isAttendanceOutOption(outOption)) throw new Error("Invalid attendance OUT option");
  if (documentOption && !isDocumentSubmissionOption(documentOption)) throw new Error("Invalid document submission option");
  if (materialOption && !isMaterialHandoverOption(materialOption)) throw new Error("Invalid material handover option");
  const attendancePoints = (isAttendanceInOption(inOption) ? ATTENDANCE_IN_POINTS[inOption].points : 0)
    + (isAttendanceOutOption(outOption) ? ATTENDANCE_OUT_POINTS[outOption].points : 0);
  const documentPoints = isDocumentSubmissionOption(documentOption) ? DOCUMENT_SUBMISSION_POINTS[documentOption].points : 0;
  const materialPoints = isMaterialHandoverOption(materialOption) ? MATERIAL_HANDOVER_POINTS[materialOption].points : 0;
  const dailyTotal = attendancePoints + documentPoints + materialPoints;
  const range = getDateRange(date);

  await prisma.$transaction(async (transaction) => {
    const employee = await transaction.user.findUnique({ where: { id: employeeId }, select: { id: true } });
    if (!employee) throw new Error("Employee not found");
    const existing = await transaction.employeePointAdjustment.findMany({
      where: { employeeId, createdAt: { gte: range.startAt, lt: new Date(range.endAt) } },
      orderBy: { createdAt: "desc" },
    });
    const previousDailyTotal = existing.reduce((sum, item) => sum + item.attendancePoints + item.documentSubmissionPoints + item.materialHandoverPoints, 0);
    const dailyFields = {
      attendanceOption: JSON.stringify({ inOption, outOption }), attendancePoints,
      documentSubmissionOption: documentOption, documentSubmissionPoints: documentPoints,
      materialHandoverOption: materialOption, materialHandoverPoints: materialPoints,
    };
    if (existing.length === 0) {
      await transaction.employeePointAdjustment.create({ data: {
        employeeId, updatedById: session.userId, createdAt: date, ...dailyFields,
        reviewOption: "", reviewPoints: 0, teamworkOption: "", teamworkPoints: 0, totalDelta: dailyTotal,
      } });
    } else {
      for (const [index, item] of existing.entries()) {
        const oldDaily = item.attendancePoints + item.documentSubmissionPoints + item.materialHandoverPoints;
        await transaction.employeePointAdjustment.update({ where: { id: item.id }, data: {
          updatedById: session.userId,
          ...(index === 0 ? dailyFields : {
            attendanceOption: JSON.stringify({ inOption: "", outOption: "" }), attendancePoints: 0,
            documentSubmissionOption: "", documentSubmissionPoints: 0,
            materialHandoverOption: "", materialHandoverPoints: 0,
          }),
          totalDelta: item.totalDelta - oldDaily + (index === 0 ? dailyTotal : 0),
        } });
      }
    }
    await applyPointDelta(transaction, employeeId, dailyTotal - previousDailyTotal, date);
  });
  revalidatePath("/report");
  revalidatePath("/dashboard");
}

export async function saveEmployeeDocketReviews(formData: FormData) {
  const session = await getSession();
  if (!session || !roleCanAssign(session.role)) redirect("/dashboard");
  const employeeId = getRequiredField(formData, "employeeId");
  const date = parseDate(getRequiredField(formData, "adjustmentDate"));
  const range = getDateRange(date);
  const entries = getPerformanceReviewEntries(formData);
  await prisma.$transaction(async (transaction) => {
    const assignments = await transaction.serviceAssignment.findMany({
      where: { id: { in: entries.map((entry) => entry.assignmentId) }, employeeId,
        assignedAt: { gte: range.startAt, lt: new Date(range.endAt) }, request: { deletedAt: null } },
      select: { id: true, requestId: true },
    });
    if (assignments.length !== entries.length) throw new Error("The selected dockets are not assigned to this employee on this date.");
    const existing = await transaction.employeePointAdjustment.findMany({
      where: { employeeId, createdAt: { gte: range.startAt, lt: new Date(range.endAt) } },
      orderBy: { createdAt: "desc" },
    });
    for (const entry of entries) {
      const assignment = assignments.find((item) => item.id === entry.assignmentId)!;
      const teamworkOption = encodeTaskReviewNote({ assignmentId: assignment.id, requestId: assignment.requestId, note: entry.reviewNote });
      const saved = existing.find((item) => decodeTaskReviewNote(item.teamworkOption)?.assignmentId === assignment.id);
      if (saved) {
        await transaction.employeePointAdjustment.update({ where: { id: saved.id }, data: { teamworkOption, updatedById: session.userId } });
      } else {
        await transaction.employeePointAdjustment.create({ data: {
          employeeId, updatedById: session.userId, createdAt: date, teamworkOption,
          attendanceOption: JSON.stringify({ inOption: "", outOption: "" }), attendancePoints: 0,
          reviewOption: "", reviewPoints: 0, documentSubmissionOption: "", documentSubmissionPoints: 0,
          materialHandoverOption: "", materialHandoverPoints: 0, teamworkPoints: 0, totalDelta: 0,
        } });
      }
    }
  });
  revalidatePath("/report");
}

function getPerformanceReviewEntries(formData: FormData): PerformanceReviewEntry[] {
  const rawEntries = getRequiredField(formData, "entries");
  let parsedEntries: unknown;

  try {
    parsedEntries = JSON.parse(rawEntries);
  } catch {
    throw new Error("Invalid docket reviews");
  }

  if (!Array.isArray(parsedEntries) || parsedEntries.length === 0 || parsedEntries.length > 100) {
    throw new Error("Select at least one valid allotted docket");
  }

  const assignmentIds = new Set<string>();
  return parsedEntries.map((entry) => {
    if (!entry || typeof entry !== "object") {
      throw new Error("Invalid docket review");
    }

    const assignmentId = "assignmentId" in entry && typeof entry.assignmentId === "string"
      ? entry.assignmentId.trim()
      : "";
    const reviewNote = "reviewNote" in entry && typeof entry.reviewNote === "string"
      ? entry.reviewNote.trim().slice(0, 1000)
      : "";

    if (!assignmentId || assignmentIds.has(assignmentId)) {
      throw new Error("Invalid or duplicate allotted docket");
    }

    assignmentIds.add(assignmentId);
    return { assignmentId, reviewNote };
  });
}

export async function saveEmployeePerformanceTags(formData: FormData) {
  const entries = getPerformanceReviewEntries(formData);

  for (const [index, entry] of entries.entries()) {
    const entryFormData = new FormData();
    entryFormData.append("employeeId", getRequiredField(formData, "employeeId"));
    entryFormData.append("assignmentId", entry.assignmentId);
    entryFormData.append("adjustmentDate", getRequiredField(formData, "adjustmentDate"));
    entryFormData.append("reviewNote", entry.reviewNote);

    for (const field of [
      "attendanceInOption",
      "attendanceOutOption",
      "reviewOption",
      "documentSubmissionOption",
      "materialHandoverOption",
    ]) {
      entryFormData.append(field, index === 0 ? getOptionalField(formData, field) : "");
    }

    await saveEmployeePerformanceTag(entryFormData);
  }
}
