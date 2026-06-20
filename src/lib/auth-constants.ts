export const AUTH_USER_ID_COOKIE = "srs_uid";
export const AUTH_ROLE_COOKIE = "srs_role";

export const APP_ROLES = {
  ADMIN: "ADMIN",
  MANAGER: "MANAGER",
  EMPLOYEE: "EMPLOYEE",
} as const;

export type AppRole = (typeof APP_ROLES)[keyof typeof APP_ROLES];
