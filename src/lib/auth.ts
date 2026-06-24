import { cookies } from "next/headers";

import { APP_ROLES, AUTH_ROLE_COOKIE, AUTH_USER_ID_COOKIE, type AppRole } from "./auth-constants";

export type AuthSession = {
  userId: string;
  role: AppRole;
};

function isRole(value: string): value is AppRole {
  return value === APP_ROLES.ADMIN || value === APP_ROLES.MANAGER || value === APP_ROLES.EMPLOYEE;
}

function isValidUuid(value: string) {
  return /^[0-9a-fA-F\-]{36}$/.test(value);
}

export async function getSession(): Promise<AuthSession | null> {
  const cookieStore = await cookies();
  const userIdRaw = cookieStore.get(AUTH_USER_ID_COOKIE)?.value;
  const roleRaw = cookieStore.get(AUTH_ROLE_COOKIE)?.value;

  if (!userIdRaw || !roleRaw || !isRole(roleRaw) || !isValidUuid(userIdRaw)) {
    return null;
  }

  return { userId: userIdRaw, role: roleRaw };
}

export function roleCanAssign(role: AppRole) {
  return role === APP_ROLES.ADMIN || role === APP_ROLES.MANAGER;
}

export function roleCanCreateService(role: AppRole) {
  return role === APP_ROLES.ADMIN || role === APP_ROLES.MANAGER;
}

export function roleCanAdmin(role: AppRole) {
  return role === APP_ROLES.ADMIN;
}
