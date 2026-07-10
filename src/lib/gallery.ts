import fs from "fs";
import path from "path";
import { prisma } from "@/lib/prisma";

type DashboardGalleryItem = {
  url: string;
  type: "image" | "video";
  label: string;
  fileName: string;
  requestId: string;
  sizeLabel: string;
  uploadedAt: Date;
};

export type DashboardRequestMediaItem = Pick<DashboardGalleryItem, "url" | "type" | "label" | "fileName">;

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

        const stat = await fs.promises.stat(path.join(folder.requestPath, file.name));

        groups[company] = groups[company] || [];
        groups[company].push({
          url: `/uploads/${encodeURIComponent(folder.userId)}/${encodeURIComponent(folder.requestId)}/${encodeURIComponent(file.name)}`,
          type: isVideo ? "video" : "image",
          label: `${folder.requestId} - ${file.name}`,
          fileName: file.name,
          requestId: folder.requestId,
          sizeLabel: formatFileSize(stat.size),
          uploadedAt: stat.mtime,
        });
      }
    }
  } catch {
    return [];
  }

  return Object.entries(groups)
    .map(([company, items]) => ({
      company,
      items: items.sort((a, b) => b.uploadedAt.getTime() - a.uploadedAt.getTime()),
    }))
    .sort((a, b) => a.company.localeCompare(b.company));
}

export async function getDashboardMediaItemsByRequestIds(
  requestIds: string[],
): Promise<Map<string, DashboardRequestMediaItem[]>> {
  const uniqueRequestIds = Array.from(new Set(requestIds.filter(Boolean)));
  const requestIdSet = new Set(uniqueRequestIds);
  const uploadsBase = path.join(process.cwd(), "public", "uploads");
  const mediaByRequestId = new Map<string, Array<DashboardRequestMediaItem & { uploadedAt: Date }>>();

  if (uniqueRequestIds.length === 0) {
    return new Map();
  }

  try {
    const userDirs = await fs.promises.readdir(uploadsBase, { withFileTypes: true });

    for (const userDir of userDirs) {
      if (!userDir.isDirectory()) {
        continue;
      }

      const userPath = path.join(uploadsBase, userDir.name);
      const requestDirs = await fs.promises.readdir(userPath, { withFileTypes: true });

      for (const requestDir of requestDirs) {
        if (!requestDir.isDirectory() || !requestIdSet.has(requestDir.name)) {
          continue;
        }

        const requestPath = path.join(userPath, requestDir.name);
        const files = await fs.promises.readdir(requestPath, { withFileTypes: true });

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

          const stat = await fs.promises.stat(path.join(requestPath, file.name));
          const currentItems = mediaByRequestId.get(requestDir.name) ?? [];
          currentItems.push({
            url: `/uploads/${encodeURIComponent(userDir.name)}/${encodeURIComponent(requestDir.name)}/${encodeURIComponent(file.name)}`,
            type: isVideo ? "video" : "image",
            label: `${requestDir.name} - ${file.name}`,
            fileName: file.name,
            uploadedAt: stat.mtime,
          });
          mediaByRequestId.set(requestDir.name, currentItems);
        }
      }
    }
  } catch {
    return new Map();
  }

  return new Map(
    Array.from(mediaByRequestId.entries()).map(([requestId, items]) => [
      requestId,
      items
        .sort((a, b) => b.uploadedAt.getTime() - a.uploadedAt.getTime())
        .map((item) => ({
          url: item.url,
          type: item.type,
          label: item.label,
          fileName: item.fileName,
        })),
    ]),
  );
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  const kilobytes = bytes / 1024;
  if (kilobytes < 1024) {
    return `${kilobytes.toFixed(kilobytes >= 10 ? 0 : 1)} KB`;
  }

  const megabytes = kilobytes / 1024;
  return `${megabytes.toFixed(megabytes >= 10 ? 0 : 1)} MB`;
}
