import { NextResponse } from "next/server";
import QRCode from "qrcode";

import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

type RouteContext = {
  params: Promise<{ transactionNumber: string }>;
};

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

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { transactionNumber: encodedTransactionNumber } = await context.params;
    const transactionNumber = decodeURIComponent(encodedTransactionNumber).trim();

    if (!transactionNumber) {
      return jsonResponse(
        {
          ok: false,
          message: "Transaction number is required.",
        },
        { status: 400 }
      );
    }

    const booking = await prisma.booking.findUnique({
      where: { transactionNumber },
      select: {
        id: true,
        name: true,
        bookingDateTime: true,
        transactionNumber: true,
      },
    });

    if (!booking) {
      return jsonResponse(
        {
          ok: false,
          message: "Booking not found.",
        },
        { status: 404 }
      );
    }

    const qrPayload = `BK${booking.id.replaceAll("-", "").slice(0, 18).toUpperCase()}`;

    const qrBuffer = await QRCode.toBuffer(qrPayload, {
      type: "png",
      width: 500,
      margin: 2,
      errorCorrectionLevel: "H",
    });

    return new NextResponse(new Uint8Array(qrBuffer), {
      status: 200,
      headers: {
        ...corsHeaders,
        "Cache-Control": "no-store, max-age=0",
        "Content-Disposition": `inline; filename="${booking.transactionNumber}.png"`,
        "Content-Length": qrBuffer.length.toString(),
        "Content-Type": "image/png",
      },
    });
  } catch (error) {
    console.error("QR generation error:", error);

    return jsonResponse(
      {
        ok: false,
        message: "Unable to generate QR code.",
      },
      { status: 500 }
    );
  }
}
