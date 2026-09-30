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
