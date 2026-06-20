type AssignmentWhatsAppPayload = {
  toPhone: string;
  employeeName: string;
  docketNumber: string;
  customerName: string;
  company: string;
  area: string;
  product: string;
  callType: string;
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

  const cleaned = trimmed.replace(/[\s()-]/g, "");
  if (!/^\+?\d{8,15}$/.test(cleaned)) {
    return null;
  }

  return cleaned.startsWith("+") ? cleaned : `+${cleaned}`;
}

function buildAssignmentMessage(payload: AssignmentWhatsAppPayload) {
  return [
    `Hello ${payload.employeeName},`,
    `A new service call has been allocated to you.`,
    `Docket: ${payload.docketNumber}`,
    `Customer: ${payload.customerName}`,
    `Company: ${payload.company}`,
    `Area: ${payload.area}`,
    `Product: ${payload.product}`,
    `Call Type: ${payload.callType}`,
  ].join("\n");
}

export async function sendAssignmentWhatsApp(payload: AssignmentWhatsAppPayload): Promise<SendResult> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const fromPhoneRaw = process.env.TWILIO_WHATSAPP_FROM;

  if (!accountSid || !authToken || !fromPhoneRaw) {
    return { sent: false, reason: "missing-whatsapp-config" };
  }

  const fromPhone = normalizePhone(fromPhoneRaw);
  const toPhone = normalizePhone(payload.toPhone);

  if (!fromPhone || !toPhone) {
    return { sent: false, reason: "invalid-whatsapp-number" };
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

  if (!response.ok) {
    return { sent: false, reason: `twilio-error-${response.status}` };
  }

  return { sent: true };
}
