import { randomUUID } from "node:crypto";

import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

function generateTransactionNumber() {
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
    .format(new Date())
    .replaceAll("-", "");

  const randomCode = randomUUID().replaceAll("-", "").slice(0, 6).toUpperCase();

  return `TXN-${today}-${randomCode}`;
}

async function createUniqueTransactionNumber() {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const transactionNumber = generateTransactionNumber();
    const existingBooking = await prisma.booking.findUnique({
      where: { transactionNumber },
      select: { id: true },
    });

    if (!existingBooking) {
      return transactionNumber;
    }
  }

  throw new Error("Unable to generate a unique transaction number.");
}

function jsonResponse(data: unknown, init?: ResponseInit) {
  return NextResponse.json(data, {
    ...init,
    headers: {
      ...corsHeaders,
      ...init?.headers,
    },
  });
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders,
  });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const name = typeof body.name === "string" ? body.name.trim() : "";
    const bookingDate = typeof body.bookingDate === "string" ? body.bookingDate.trim() : "";
    const bookingTime = typeof body.bookingTime === "string" ? body.bookingTime.trim() : "";

    if (!name || !bookingDate || !bookingTime) {
      return jsonResponse(
        {
          ok: false,
          message: "Name, booking date and booking time are required.",
        },
        { status: 400 }
      );
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(bookingDate)) {
      return jsonResponse(
        {
          ok: false,
          message: "Booking date must use YYYY-MM-DD format.",
        },
        { status: 400 }
      );
    }

    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(bookingTime)) {
      return jsonResponse(
        {
          ok: false,
          message: "Booking time must use HH:mm format.",
        },
        { status: 400 }
      );
    }

    const bookingDateTime = new Date(`${bookingDate}T${bookingTime}:00+05:30`);

    if (Number.isNaN(bookingDateTime.getTime())) {
      return jsonResponse(
        {
          ok: false,
          message: "Invalid booking date or booking time.",
        },
        { status: 400 }
      );
    }

    const transactionNumber = await createUniqueTransactionNumber();
    const booking = await prisma.booking.create({
      data: {
        name,
        bookingDateTime,
        transactionNumber,
      },
      select: {
        id: true,
        name: true,
        transactionNumber: true,
        createdAt: true,
      },
    });

    return jsonResponse(
      {
        ok: true,
        message: "Booking saved successfully.",
        transactionNumber: booking.transactionNumber,
        qrUrl: `/api/generate-qr/${encodeURIComponent(booking.transactionNumber)}`,
        booking: {
          id: booking.id,
          name: booking.name,
          bookingDate,
          bookingTime,
          transactionNumber: booking.transactionNumber,
          createdAt: booking.createdAt,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Booking API error:", error);

    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return jsonResponse(
        {
          ok: false,
          message: "A booking with this transaction number already exists.",
        },
        { status: 409 }
      );
    }

    return jsonResponse(
      {
        ok: false,
        message: "Unable to save the booking.",
      },
      { status: 500 }
    );
  }
}
