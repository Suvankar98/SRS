import { getDashboardGalleryItems } from "@/lib/gallery";
import { getSession, roleCanAssign } from "@/lib/auth";
import { redirect } from "next/navigation";
import { GalleryClient } from "./gallery-client";

export const dynamic = "force-dynamic";

export default async function GalleryPage() {
  const session = await getSession();

  if (!session) {
    redirect("/");
  }

  if (!roleCanAssign(session.role)) {
    redirect("/dashboard");
  }

  const items = await getDashboardGalleryItems();

  return (
    <GalleryClient
      items={items.map((item) => ({
        ...item,
        uploadedAt: item.uploadedAt.toISOString(),
      }))}
    />
  );
}
