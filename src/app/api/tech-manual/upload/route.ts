import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";

import { getSession, roleCanAssign } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

const MAX_CHUNK_BYTES = 900 * 1024;
const MAX_UPLOAD_BYTES = 250 * 1024 * 1024;

function getString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function sanitizeFileName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, "-").slice(0, 200);
}

function getTechManualDocumentType(fileName: string) {
  const extension = fileName.split(".").pop()?.toLowerCase() ?? "";

  if (["png", "jpeg", "jpg", "webp", "gif"].includes(extension)) {
    return "image";
  }

  if (["mp4", "m4v", "webm", "mov", "qt", "ogv", "avi", "mkv", "3gp", "wmv"].includes(extension)) {
    return "video";
  }

  if (extension === "pdf") {
    return "pdf";
  }

  if (["doc", "docx", "rtf"].includes(extension)) {
    return "word";
  }

  throw new Error("Unsupported manual document type.");
}

function getTechManualCategoryPath(category: string) {
  return `/tech-manual/${category}`;
}

function getTechManualFolderPath(category: string, folderId: string) {
  return `${getTechManualCategoryPath(category)}/${folderId}`;
}

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session || !roleCanAssign(session.role)) {
      return NextResponse.json({ ok: false, message: "Unauthorized" }, { status: 403 });
    }

    const formData = await request.formData();
    const uploadId = getString(formData, "uploadId");
    const folderId = getString(formData, "folderId");
    const documentName = getString(formData, "documentName");
    const fileName = getString(formData, "fileName");
    const chunkIndex = Number.parseInt(getString(formData, "chunkIndex"), 10);
    const totalChunks = Number.parseInt(getString(formData, "totalChunks"), 10);
    const totalSize = Number.parseInt(getString(formData, "totalSize"), 10);
    const chunk = formData.get("chunk");

    if (!/^[a-zA-Z0-9_-]{8,80}$/.test(uploadId)) {
      return NextResponse.json({ ok: false, message: "Invalid upload session." }, { status: 400 });
    }

    if (!folderId || !documentName || !fileName || !Number.isInteger(chunkIndex) || !Number.isInteger(totalChunks)) {
      return NextResponse.json({ ok: false, message: "Missing upload details." }, { status: 400 });
    }

    if (totalChunks < 1 || chunkIndex < 0 || chunkIndex >= totalChunks) {
      return NextResponse.json({ ok: false, message: "Invalid upload chunk." }, { status: 400 });
    }

    if (!Number.isInteger(totalSize) || totalSize <= 0 || totalSize > MAX_UPLOAD_BYTES) {
      return NextResponse.json({ ok: false, message: "Please upload a document up to 250 MB." }, { status: 400 });
    }

    if (!chunk || typeof chunk === "string" || chunk.size === 0 || chunk.size > MAX_CHUNK_BYTES) {
      return NextResponse.json({ ok: false, message: "Upload chunk is too large. Please try again." }, { status: 400 });
    }

    const folder = await prisma.techManualFolder.findUnique({
      where: { id: folderId },
      select: { id: true, category: true },
    });

    if (!folder) {
      return NextResponse.json({ ok: false, message: "Tech manual folder not found." }, { status: 404 });
    }

    const documentType = getTechManualDocumentType(fileName);
    const path = await import("path");
    const fs = await import("fs");
    const uploadsBase = path.join(process.cwd(), "public", "manual-uploads");
    const chunkBase = path.join(process.cwd(), "public", "manual-upload-chunks");
    const uploadDir = path.join(chunkBase, uploadId);

    await fs.promises.mkdir(uploadDir, { recursive: true });
    await fs.promises.writeFile(path.join(uploadDir, `${chunkIndex}.part`), Buffer.from(await chunk.arrayBuffer()));

    if (chunkIndex !== totalChunks - 1) {
      return NextResponse.json({ ok: true, complete: false });
    }

    const folderPath = path.join(uploadsBase, folder.id);
    await fs.promises.mkdir(folderPath, { recursive: true });

    const safeName = `${Date.now()}-${sanitizeFileName(fileName)}`;
    const filePath = path.join(folderPath, safeName);
    const writeStream = fs.createWriteStream(filePath);

    try {
      for (let index = 0; index < totalChunks; index += 1) {
        const partPath = path.join(uploadDir, `${index}.part`);
        const part = await fs.promises.readFile(partPath);
        writeStream.write(part);
      }
    } finally {
      await new Promise<void>((resolve, reject) => {
        writeStream.end(() => resolve());
        writeStream.on("error", reject);
      });
      await fs.promises.rm(uploadDir, { recursive: true, force: true }).catch(() => undefined);
    }

    const actor = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { name: true },
    });

    await prisma.techManualDocument.create({
      data: {
        folderId: folder.id,
        name: documentName,
        documentType,
        fileName,
        fileUrl: `/manual-uploads/${encodeURIComponent(folder.id)}/${encodeURIComponent(safeName)}`,
        uploadedById: session.userId,
        uploadedByName: actor?.name ?? "Admin / Manager",
      },
    });

    revalidatePath(getTechManualCategoryPath(folder.category));
    revalidatePath(getTechManualFolderPath(folder.category, folder.id));

    return NextResponse.json({ ok: true, complete: true, message: "Document uploaded successfully." });
  } catch (error) {
    console.error("Chunked tech manual upload failed", error);
    return NextResponse.json(
      { ok: false, message: error instanceof Error ? error.message : "Upload failed. Please try again." },
      { status: 500 },
    );
  }
}
