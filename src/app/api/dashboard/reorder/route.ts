import { NextResponse } from "next/server";

import { getSession, roleCanAssign } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const PRIORITY_DAY_FACTOR = 10000;
const PRIORITY_TIME_ZONE = "Asia/Kolkata";

function getRequestIds(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((entry): entry is string => typeof entry === "string")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function getStarredDays(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return new Map<string, number>();
  }

  return new Map(
    Object.entries(value)
      .filter((entry): entry is [string, number] => {
        const [requestId, day] = entry;
        return requestId.trim() !== "" && Number.isInteger(day) && day > 0;
      })
      .map(([requestId, day]) => [requestId, day]),
  );
}

function getTodayPriorityDay() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: PRIORITY_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const year = Number(parts.find((part) => part.type === "year")?.value);
  const month = Number(parts.find((part) => part.type === "month")?.value);
  const day = Number(parts.find((part) => part.type === "day")?.value);

  return Math.floor(Date.UTC(year, month - 1, day) / (1000 * 60 * 60 * 24));
}

export async function POST(request: Request) {
  const session = await getSession();

  if (!session || !roleCanAssign(session.role)) {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const requestIds = getRequestIds(body.requestIds);
    const starredRequestIds = new Set(getRequestIds(body.starredRequestIds));
    const starredDays = getStarredDays(body.starredDays);
    const todayPriorityDay = getTodayPriorityDay();

    if (requestIds.length === 0) {
      return NextResponse.json({ success: false, message: "No requests supplied" }, { status: 400 });
    }

    await prisma.$transaction(
      requestIds.map((requestId, index) =>
        prisma.serviceRequest.update({
          where: { id: requestId },
          data: {
            dashboardOrder: starredRequestIds.has(requestId)
              ? -((starredDays.get(requestId) ?? todayPriorityDay) * PRIORITY_DAY_FACTOR + index + 1)
              : index + 1,
          },
        }),
      ),
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Dashboard reorder failed", error);
    return NextResponse.json({ success: false, message: "Server error" }, { status: 500 });
  }
}
