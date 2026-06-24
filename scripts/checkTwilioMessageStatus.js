const fs = require("fs");
const path = require("path");

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

async function main() {
  loadEnvFile();

  const sid = process.argv[2];
  if (!sid) {
    throw new Error("Usage: node scripts/checkTwilioMessageStatus.js <MESSAGE_SID>");
  }

  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  if (!accountSid || !authToken) {
    throw new Error("Missing TWILIO_ACCOUNT_SID or TWILIO_AUTH_TOKEN in environment.");
  }

  const authHeader = Buffer.from(`${accountSid}:${authToken}`).toString("base64");
  const response = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages/${sid}.json`,
    {
      headers: {
        Authorization: `Basic ${authHeader}`,
      },
    }
  );

  const body = await response.json();
  if (!response.ok) {
    throw new Error(`Twilio API error (${response.status}): ${body?.message || "unknown"}`);
  }

  console.log(`sid=${body.sid}`);
  console.log(`status=${body.status}`);
  console.log(`to=${body.to}`);
  console.log(`from=${body.from}`);
  console.log(`errorCode=${body.error_code || "none"}`);
  console.log(`errorMessage=${body.error_message || "none"}`);
  console.log(`dateSent=${body.date_sent || "null"}`);
  console.log(`dateUpdated=${body.date_updated || "null"}`);
}

main().catch((error) => {
  console.error(error.message || error);
  process.exitCode = 1;
});
