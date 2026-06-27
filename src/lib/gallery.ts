import fs from "fs";
import path from "path";
import { prisma } from "@/lib/prisma";

type DashboardGalleryItem = {
  url: string;
  type: "image" | "video";
  label: string;
};

export type DashboardGalleryGroup = {
  company: string;
  items: DashboardGalleryItem[];
};

export async function getDashboardGalleryItemsByCompany(): Promise<DashboardGalleryGroup[]> {
  const uploadsBase = path.join(process.cwd(), "public", "uploads");
  const groups: Record<string, DashboardGalleryItem[]> = {};

  try {
    const userDirs = await fs.promises.readdir(uploadsBase, { withFileTypes: true });
    const requestFolders: Array<{ userId: string; requestId: string; requestPath: string }> = [];

    for (const userDir of userDirs) {
      if (!userDir.isDirectory()) {
        continue;
      }

      const userPath = path.join(uploadsBase, userDir.name);
      const requestDirs = await fs.promises.readdir(userPath, { withFileTypes: true });

      for (const requestDir of requestDirs) {
        if (!requestDir.isDirectory()) {
          continue;
        }

        requestFolders.push({
          userId: userDir.name,
          requestId: requestDir.name,
          requestPath: path.join(userPath, requestDir.name),
        });
      }
    }

    const requestIds = requestFolders.map((folder) => folder.requestId);
    const requests = requestIds.length
      ? await prisma.serviceRequest.findMany({
          where: { id: { in: requestIds } },
          select: { id: true, company: true },
        })
      : [];

    const companyByRequestId = new Map(requests.map((request) => [request.id, request.company]));

    for (const folder of requestFolders) {
      const files = await fs.promises.readdir(folder.requestPath, { withFileTypes: true });
      const company = companyByRequestId.get(folder.requestId) || "Unknown Company";

      for (const file of files) {
        if (!file.isFile()) {
          continue;
        }

        const extension = path.extname(file.name).toLowerCase();
        const isVideo = [".mp4", ".webm", ".mov", ".qt"].includes(extension);
        const isImage = [".png", ".jpg", ".jpeg", ".webp", ".gif"].includes(extension);

        if (!isImage && !isVideo) {
          continue;
        }

        groups[company] = groups[company] || [];
        groups[company].push({
          url: `/uploads/${encodeURIComponent(folder.userId)}/${encodeURIComponent(folder.requestId)}/${encodeURIComponent(file.name)}`,
          type: isVideo ? "video" : "image",
          label: `${folder.requestId} • ${file.name}`,
        });
      }
    }
  } catch {
    return [];
  }

  return Object.entries(groups)
    .map(([company, items]) => ({ company, items }))
    .sort((a, b) => a.company.localeCompare(b.company));
}
