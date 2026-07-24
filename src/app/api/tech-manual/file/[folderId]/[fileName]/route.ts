import fs from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";

import { getSession } from "@/lib/auth";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ folderId: string; fileName: string }>;
};

const MIME_TYPES: Record<string, string> = {
  ".avi": "video/x-msvideo",
  ".doc": "application/msword",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".gif": "image/gif",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".m4v": "video/x-m4v",
  ".mkv": "video/x-matroska",
  ".mov": "video/quicktime",
  ".mp4": "video/mp4",
  ".pdf": "application/pdf",
  ".png": "image/png",
  ".rtf": "application/rtf",
  ".webm": "video/webm",
  ".webp": "image/webp",
  ".wmv": "video/x-ms-wmv",
};

export async function GET(_request: Request, context: RouteContext) {
  const session = await getSession();

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { folderId, fileName } = await context.params;

  if (!/^[0-9a-fA-F-]{36}$/.test(folderId) || fileName.includes("/") || fileName.includes("\\")) {
    return NextResponse.json({ error: "Invalid manual file" }, { status: 400 });
  }

  const uploadsBase = path.resolve(process.cwd(), "public", "manual-uploads");
  const filePath = path.resolve(uploadsBase, folderId, fileName);
  const uploadsRootPrefix = `${uploadsBase}${path.sep}`;

  if (!filePath.startsWith(uploadsRootPrefix)) {
    return NextResponse.json({ error: "Invalid manual file" }, { status: 400 });
  }

  const stat = await fs.stat(filePath).catch(() => null);

  if (!stat?.isFile()) {
    return NextResponse.json({ error: "Manual file not found" }, { status: 404 });
  }

  const extension = path.extname(fileName).toLowerCase();
  const contentType = MIME_TYPES[extension] ?? "application/octet-stream";
  const file = await fs.readFile(filePath);

  return new NextResponse(file, {
    headers: {
      "Cache-Control": "private, max-age=3600",
      "Content-Disposition": `inline; filename="${safeHeaderFileName(fileName)}"`,
      "Content-Length": String(stat.size),
      "Content-Type": contentType,
      "X-Content-Type-Options": "nosniff",
    },
  });
}

function safeHeaderFileName(value: string) {
  return value.replace(/["\r\n]/g, "_");
}
