const fs = require("fs");
const path = require("path");
const { PrismaClient } = require("@prisma/client");

function loadEnvFile() {
  const envPath = path.join(process.cwd(), ".env");
  if (!fs.existsSync(envPath)) {
    return;
  }

  const content = fs.readFileSync(envPath, "utf8");
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }

    const separatorIndex = line.indexOf("=");
    if (separatorIndex === -1) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    if (!key || process.env[key]) {
      continue;
    }

    let value = line.slice(separatorIndex + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    process.env[key] = value;
  }
}

function normalizePhone(raw) {
  const trimmed = String(raw || "").trim();
  if (!trimmed) {
    return null;
  }

  const withoutPrefix = trimmed.replace(/^whatsapp:/i, "");
  const cleaned = withoutPrefix.replace(/[\s()-]/g, "");
  if (!/^\+?\d{8,15}$/.test(cleaned)) {
    return null;
  }

  return cleaned.startsWith("+") ? cleaned : `+${cleaned}`;
}

function buildAssignmentMessage(payload) {
  return [
    `Hello ${payload.employeeName},`,
    "A new service call has been allocated to you.",
    `Docket: ${payload.docketNumber}`,
    `Customer: ${payload.customerName}`,
    `Company: ${payload.company}`,
    `Primary Phone: ${payload.phoneNumber1}`,
    payload.phoneNumber2 ? `Alternate Phone: ${payload.phoneNumber2}` : null,
    `Address: ${payload.fullAddress}`,
    `Area: ${payload.area}`,
    `Product: ${payload.product}`,
    `Call Type: ${payload.callType}`,
  ]
    .filter(Boolean)
    .join("\n");
}

async function sendTwilioWhatsApp(payload) {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const fromPhoneRaw = process.env.TWILIO_WHATSAPP_FROM;

  if (!accountSid || !authToken || !fromPhoneRaw) {
    throw new Error("Missing TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, or TWILIO_WHATSAPP_FROM in env.");
  }

  const fromPhone = normalizePhone(fromPhoneRaw);
  const toPhone = normalizePhone(payload.toPhone);

  if (!fromPhone || !toPhone) {
    throw new Error("Invalid sender or recipient WhatsApp number format.");
  }

  const params = new URLSearchParams({
    To: `whatsapp:${toPhone}`,
    From: `whatsapp:${fromPhone}`,
    Body: buildAssignmentMessage(payload),
  });

  const authHeader = Buffer.from(`${accountSid}:${authToken}`).toString("base64");
  const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${authHeader}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params.toString(),
  });

  const json = await response.json();

  if (!response.ok) {
    const twilioMessage = json?.message || "Unknown Twilio error";
    throw new Error(`Twilio send failed (${response.status}): ${twilioMessage}`);
  }

  return {
    sid: json.sid,
    status: json.status,
    to: json.to,
    from: json.from,
  };
}

async function main() {
  loadEnvFile();

  const prisma = new PrismaClient();
  try {
    const employee = await prisma.user.findFirst({
      where: {
        role: "EMPLOYEE",
        whatsappNumber: {
          not: null,
        },
      },
      orderBy: {
        createdAt: "asc",
      },
      select: {
        id: true,
        name: true,
        whatsappNumber: true,
      },
    });

    if (!employee || !employee.whatsappNumber) {
      throw new Error("No employee with WhatsApp number found. Add one in Admin > Staff first.");
    }

    const request = await prisma.serviceRequest.findFirst({
      orderBy: [
        {
          createdAt: "desc",
        },
      ],
      select: {
        docketNumber: true,
        name: true,
        company: true,
        phoneNumber1: true,
        phoneNumber2: true,
        fullAddress: true,
        area: true,
        product: true,
        callType: true,
      },
    });

    if (!request) {
      throw new Error("No service request found to compose test allocation message.");
    }

    const result = await sendTwilioWhatsApp({
      toPhone: employee.whatsappNumber,
      employeeName: employee.name,
      docketNumber: request.docketNumber,
      customerName: request.name,
      company: request.company,
      phoneNumber1: request.phoneNumber1,
      phoneNumber2: request.phoneNumber2,
      fullAddress: request.fullAddress,
      area: request.area,
      product: request.product,
      callType: request.callType,
    });

    console.log("WhatsApp test message sent successfully.");
    console.log(`Employee: ${employee.name}`);
    console.log(`Docket: ${request.docketNumber}`);
    console.log(`Message SID: ${result.sid}`);
    console.log(`Twilio Status: ${result.status}`);
    console.log(`To: ${result.to}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error.message || error);
  process.exitCode = 1;
});
