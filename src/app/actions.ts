"use server";

import { prisma } from "@/lib/prisma";
import { sendAssignmentWhatsApp } from "@/lib/whatsapp";
import { APP_ROLES, AUTH_ROLE_COOKIE, AUTH_USER_ID_COOKIE, type AppRole } from "@/lib/auth-constants";
import { getSession, roleCanAdmin, roleCanAssign, roleCanCreateService } from "@/lib/auth";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

function getRequiredField(formData: FormData, key: string) {
  const value = formData.get(key);

  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`Missing required field: ${key}`);
  }

  return value.trim();
}

async function requireSession() {
  const session = await getSession();
  if (!session) {
    redirect("/");
  }
  return session;
}

async function requireRole(allowedRoles: AppRole[]) {
  const session = await requireSession();

  if (!allowedRoles.includes(session.role)) {
    redirect("/dashboard");
  }

  return session;
}

export async function login(formData: FormData) {
  const username = getRequiredField(formData, "username");
  const password = getRequiredField(formData, "password");

  const user = await prisma.user.findUnique({ where: { username } });

  if (!user || user.password !== password) {
    redirect("/?error=1");
  }

  const cookieStore = await cookies();
  cookieStore.set(AUTH_USER_ID_COOKIE, String(user.id), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 12,
  });
  cookieStore.set(AUTH_ROLE_COOKIE, user.role, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 12,
  });

  redirect("/dashboard");
}

export async function logout() {
  const cookieStore = await cookies();
  cookieStore.delete(AUTH_USER_ID_COOKIE);
  cookieStore.delete(AUTH_ROLE_COOKIE);
  redirect("/");
}

export async function createServiceRequest(formData: FormData) {
  await requireRole([APP_ROLES.ADMIN, APP_ROLES.MANAGER]);

  const name = getRequiredField(formData, "name");
  const company = getRequiredField(formData, "company");
  const phoneNumber1 = getRequiredField(formData, "phoneNumber1");
  const fullAddress = getRequiredField(formData, "fullAddress");
  const area = getRequiredField(formData, "area");
  const product = getRequiredField(formData, "product");
  const callType = getRequiredField(formData, "callType");
  const phoneNumber2Value = formData.get("phoneNumber2");
  const phoneNumber2 =
    typeof phoneNumber2Value === "string" && phoneNumber2Value.trim() !== ""
      ? phoneNumber2Value.trim()
      : null;

  const request = await prisma.$transaction(async (transaction) => {
    const created = await transaction.serviceRequest.create({
      data: {
        docketNumber: "TEMP",
        name,
        company,
        phoneNumber1,
        phoneNumber2,
        fullAddress,
        area,
        product,
        callType,
      },
    });

    return transaction.serviceRequest.update({
      where: { id: created.id },
      data: { docketNumber: `SRS-${created.id}` },
    });
  });

  revalidatePath("/form");
  revalidatePath("/dashboard");
  redirect(`/dashboard?created=${request.docketNumber}`);
}

export async function updateServiceRequestDetails(formData: FormData) {
  await requireRole([APP_ROLES.ADMIN, APP_ROLES.MANAGER]);

  const requestId = Number(getRequiredField(formData, "requestId"));
  const name = getRequiredField(formData, "name");
  const company = getRequiredField(formData, "company");
  const phoneNumber1 = getRequiredField(formData, "phoneNumber1");
  const fullAddress = getRequiredField(formData, "fullAddress");
  const area = getRequiredField(formData, "area");
  const product = getRequiredField(formData, "product");
  const callType = getRequiredField(formData, "callType");
  const phoneNumber2Raw = formData.get("phoneNumber2");
  const phoneNumber2 =
    typeof phoneNumber2Raw === "string" && phoneNumber2Raw.trim() !== ""
      ? phoneNumber2Raw.trim()
      : null;

  await prisma.serviceRequest.update({
    where: { id: requestId },
    data: {
      name,
      company,
      phoneNumber1,
      phoneNumber2,
      fullAddress,
      area,
      product,
      callType,
    },
  });

  revalidatePath("/dashboard");
  redirect("/dashboard");
}

export async function addStaff(formData: FormData) {
  await requireRole([APP_ROLES.ADMIN]);

  const name = getRequiredField(formData, "name");
  const username = getRequiredField(formData, "username");
  const password = getRequiredField(formData, "password");
  const role = getRequiredField(formData, "role");
  const whatsappRaw = formData.get("whatsappNumber");
  const whatsappNumber = typeof whatsappRaw === "string" && whatsappRaw.trim() !== "" ? whatsappRaw.trim() : null;

  if (role !== APP_ROLES.MANAGER && role !== APP_ROLES.EMPLOYEE) {
    throw new Error("Invalid role selected");
  }

  await prisma.user.create({
    data: {
      name,
      username,
      password,
      whatsappNumber,
      role,
    },
  });

  revalidatePath("/admin");
  redirect("/admin?tab=staff");
}

export async function deleteStaff(formData: FormData) {
  await requireRole([APP_ROLES.ADMIN]);

  const id = Number(getRequiredField(formData, "id"));
  const user = await prisma.user.findUnique({
    where: { id },
    select: { role: true },
  });

  if (!user || (user.role !== APP_ROLES.MANAGER && user.role !== APP_ROLES.EMPLOYEE)) {
    redirect("/admin?tab=staff");
  }

  await prisma.user.delete({ where: { id } });

  revalidatePath("/admin");
  revalidatePath("/dashboard");
  redirect("/admin?tab=staff");
}

export async function updateStaff(formData: FormData) {
  await requireRole([APP_ROLES.ADMIN]);

  const id = Number(getRequiredField(formData, "id"));
  const name = getRequiredField(formData, "name");
  const username = getRequiredField(formData, "username");
  const role = getRequiredField(formData, "role");
  const whatsappRaw = formData.get("whatsappNumber");
  const whatsappNumber = typeof whatsappRaw === "string" && whatsappRaw.trim() !== "" ? whatsappRaw.trim() : null;

  if (role !== APP_ROLES.MANAGER && role !== APP_ROLES.EMPLOYEE) {
    throw new Error("Invalid role selected");
  }

  const user = await prisma.user.findUnique({
    where: { id },
    select: { role: true },
  });

  if (!user || (user.role !== APP_ROLES.MANAGER && user.role !== APP_ROLES.EMPLOYEE)) {
    redirect("/admin?tab=staff");
  }

  await prisma.user.update({
    where: { id },
    data: {
      name,
      username,
      role,
      whatsappNumber,
    },
  });

  revalidatePath("/admin");
  revalidatePath("/dashboard");
  redirect("/admin?tab=staff");
}

export async function addProduct(formData: FormData) {
  await requireRole([APP_ROLES.ADMIN]);

  const name = getRequiredField(formData, "name");

  await prisma.product.create({ data: { name } });

  revalidatePath("/admin");
  revalidatePath("/form");
  redirect("/admin?tab=products");
}

export async function updateProduct(formData: FormData) {
  await requireRole([APP_ROLES.ADMIN]);

  const id = Number(getRequiredField(formData, "id"));
  const name = getRequiredField(formData, "name");

  await prisma.product.update({
    where: { id },
    data: { name },
  });

  revalidatePath("/admin");
  revalidatePath("/form");
  redirect("/admin?tab=products");
}

export async function deleteProduct(formData: FormData) {
  await requireRole([APP_ROLES.ADMIN]);

  const id = Number(getRequiredField(formData, "id"));

  await prisma.product.delete({ where: { id } });

  revalidatePath("/admin");
  revalidatePath("/form");
  redirect("/admin?tab=products");
}

export async function addCallType(formData: FormData) {
  await requireRole([APP_ROLES.ADMIN]);

  const name = getRequiredField(formData, "name");

  await prisma.callType.create({ data: { name } });

  revalidatePath("/admin");
  revalidatePath("/form");
  redirect("/admin?tab=call-types");
}

export async function updateCallType(formData: FormData) {
  await requireRole([APP_ROLES.ADMIN]);

  const id = Number(getRequiredField(formData, "id"));
  const name = getRequiredField(formData, "name");

  await prisma.callType.update({
    where: { id },
    data: { name },
  });

  revalidatePath("/admin");
  revalidatePath("/form");
  redirect("/admin?tab=call-types");
}

export async function deleteCallType(formData: FormData) {
  await requireRole([APP_ROLES.ADMIN]);

  const id = Number(getRequiredField(formData, "id"));

  await prisma.callType.delete({ where: { id } });

  revalidatePath("/admin");
  revalidatePath("/form");
  redirect("/admin?tab=call-types");
}

export async function assignServiceCall(formData: FormData) {
  const session = await requireSession();

  if (!roleCanAssign(session.role)) {
    redirect("/dashboard");
  }

  const requestId = Number(getRequiredField(formData, "requestId"));
  const assignedToIdRaw = formData.get("assignedToId");
  const assignedToIdValue = typeof assignedToIdRaw === "string" ? assignedToIdRaw.trim() : "";
  const assignedToId = assignedToIdValue === "" ? null : Number(assignedToIdValue);
  const previousRequest = await prisma.serviceRequest.findUnique({
    where: { id: requestId },
    select: {
      assignedToId: true,
      docketNumber: true,
      name: true,
      company: true,
      area: true,
      product: true,
      callType: true,
    },
  });

  await prisma.serviceRequest.update({
    where: { id: requestId },
    data: { assignedToId },
  });

  const shouldNotify =
    !!previousRequest &&
    assignedToId !== null &&
    assignedToId !== previousRequest.assignedToId;

  if (shouldNotify) {
    const assignee = await prisma.user.findUnique({
      where: { id: assignedToId },
      select: { name: true, role: true, whatsappNumber: true },
    });

    if (assignee?.role === APP_ROLES.EMPLOYEE && assignee.whatsappNumber) {
      try {
        const whatsappResult = await sendAssignmentWhatsApp({
          toPhone: assignee.whatsappNumber,
          employeeName: assignee.name,
          docketNumber: previousRequest.docketNumber,
          customerName: previousRequest.name,
          company: previousRequest.company,
          area: previousRequest.area,
          product: previousRequest.product,
          callType: previousRequest.callType,
        });

        if (!whatsappResult.sent) {
          console.warn("WhatsApp allocation message was not sent", {
            requestId,
            assignedToId,
            reason: whatsappResult.reason,
          });
        }
      } catch (error) {
        console.error("Failed to send WhatsApp allocation message", error);
      }
    }
  }

  revalidatePath("/dashboard");
  redirect("/dashboard");
}

export async function updateServiceCallStatus(formData: FormData) {
  const session = await requireSession();

  // Only employees can update status
  if (session.role !== APP_ROLES.EMPLOYEE) {
    redirect("/dashboard");
  }

  const requestId = Number(getRequiredField(formData, "requestId"));
  const status = getRequiredField(formData, "status");
  const statusReason = formData.get("statusReason");
  const reasonValue = typeof statusReason === "string" ? statusReason.trim() : "";

  // Validate status values
  const validStatuses = ["Pending", "Cancel", "Visit & Reschedule", "Close"];
  if (!validStatuses.includes(status)) {
    throw new Error("Invalid status");
  }

  // Verify the request belongs to the employee
  const request = await prisma.serviceRequest.findUnique({
    where: { id: requestId },
    select: { assignedToId: true },
  });

  if (request?.assignedToId !== session.userId) {
    redirect("/dashboard");
  }

  await prisma.serviceRequest.update({
    where: { id: requestId },
    data: {
      status,
      statusReason: reasonValue || null,
    },
  });

  revalidatePath("/dashboard");
  redirect("/dashboard");
}

export async function canOpenAdmin(): Promise<boolean> {
  const session = await getSession();
  return !!session && roleCanAdmin(session.role);
}

export async function canCreateService(): Promise<boolean> {
  const session = await getSession();
  return !!session && roleCanCreateService(session.role);
}
