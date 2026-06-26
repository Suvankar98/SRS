type AssignmentWhatsAppPayload = {
  toPhone: string;
  employeeName: string;
  docketNumber: string;
  customerName: string;
  company: string;
  phoneNumber1: string;
  phoneNumber2?: string | null;
  fullAddress: string;
  complaintDetails?: string | null;
  area: string;
  product: string;
  callType: string;
};

type CustomerComplaintRegisteredWhatsAppPayload = {
  toPhone: string;
  customerName: string;
  docketNumber: string;
};

type SendResult = {
  sent: boolean;
  reason?: string;
};

function normalizePhone(raw: string) {
  const trimmed = raw.trim();
  if (!trimmed) {
    return null;
  }

  const withoutPrefix = trimmed.replace(/^whatsapp:/i, "");
  const compact = withoutPrefix.replace(/[\s().-]/g, "");
  const withoutIntlPrefix = compact.startsWith("00") ? compact.slice(2) : compact;

  if (/^\+\d{8,15}$/.test(withoutIntlPrefix)) {
    return withoutIntlPrefix;
  }

  if (!/^\d{8,15}$/.test(withoutIntlPrefix)) {
    return null;
  }

  // Most customer numbers are entered as local Indian mobile numbers.
  // Handle both 10-digit format and 11-digit numbers with leading 0.
  if (withoutIntlPrefix.length === 11 && withoutIntlPrefix.startsWith("0")) {
    return `+91${withoutIntlPrefix.slice(1)}`;
  }

  // Default to +91 when no country code is supplied.
  if (withoutIntlPrefix.length === 10) {
    return `+91${withoutIntlPrefix}`;
  }

  // Handle explicit India country code without + prefix.
  if (withoutIntlPrefix.length === 12 && withoutIntlPrefix.startsWith("91")) {
    return `+${withoutIntlPrefix}`;
  }

  return `+${withoutIntlPrefix}`;
}

function buildAssignmentMessage(payload: AssignmentWhatsAppPayload) {
  const projectLink = process.env.PROJECT_LINK?.trim();

  return [
    `Hello ${payload.employeeName},`,
    `A new service call has been allocated to you.`,
    `Docket: ${payload.docketNumber}`,
    `Customer: ${payload.customerName}`,
    `Company: ${payload.company}`,
    `Primary Phone: ${payload.phoneNumber1}`,
    payload.phoneNumber2 ? `Alternate Phone: ${payload.phoneNumber2}` : null,
    `Address: ${payload.fullAddress}`,
    payload.complaintDetails ? `Complaint: ${payload.complaintDetails}` : null,
    `Area: ${payload.area}`,
    `Product: ${payload.product}`,
    `Call Type: ${payload.callType}`,
    projectLink ? `Project Link: ${projectLink}` : null,
  ]
    .filter((line): line is string => Boolean(line))
    .join("\n");
}

function buildCustomerComplaintRegisteredMessage(payload: CustomerComplaintRegisteredWhatsAppPayload) {
  return [
    `Hello ${payload.customerName},`,
    `Your complaint has been registered successfully.`,
    `Docket Number: ${payload.docketNumber}`,
    `Please keep this docket number for future reference.`,
  ]
    .filter((line): line is string => Boolean(line))
    .join("\n");
}

async function sendWhatsAppMessage(toPhoneRaw: string, body: string): Promise<SendResult> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const fromPhoneRaw = process.env.TWILIO_WHATSAPP_FROM;

  if (!accountSid || !authToken || !fromPhoneRaw) {
    return { sent: false, reason: "missing-whatsapp-config" };
  }

  const fromPhone = normalizePhone(fromPhoneRaw);
  const toPhone = normalizePhone(toPhoneRaw);

  if (!fromPhone || !toPhone) {
    return { sent: false, reason: "invalid-whatsapp-number" };
  }

  const params = new URLSearchParams({
    To: `whatsapp:${toPhone}`,
    From: `whatsapp:${fromPhone}`,
    Body: body,
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

  if (!response.ok) {
    let detail = "unknown";

    try {
      const payload = (await response.json()) as { message?: string; code?: number };
      detail = payload.message || (payload.code ? `code-${payload.code}` : "unknown");
    } catch {
      // Ignore parse errors and keep fallback reason.
    }

    return {
      sent: false,
      reason: `twilio-error-${response.status}:${detail}`,
    };
  }

  return { sent: true };
}

export async function sendAssignmentWhatsApp(payload: AssignmentWhatsAppPayload): Promise<SendResult> {
  return sendWhatsAppMessage(payload.toPhone, buildAssignmentMessage(payload));
}

export async function sendCustomerComplaintRegisteredWhatsApp(
  payload: CustomerComplaintRegisteredWhatsAppPayload,
): Promise<SendResult> {
  return sendWhatsAppMessage(payload.toPhone, buildCustomerComplaintRegisteredMessage(payload));
}
