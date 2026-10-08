import { prisma } from "./prisma";

export const SALARY_SLIP_MIME_TYPES = ["application/pdf", "image/jpeg", "image/png"] as const;
export const SALARY_SLIP_MAX_IMAGE_FILE_SIZE = 10 * 1024 * 1024;
export const SALARY_SLIP_MAX_PDF_FILE_SIZE = 20 * 1024 * 1024;
export const SALARY_SLIP_MAX_TOTAL_UPLOAD_SIZE = 100 * 1024 * 1024;
export const SALARY_SLIP_MAX_FILES_PER_UPLOAD = 10;

export type SalarySlipMetadataRow = {
  id: string;
  employeeId: string;
  year: number;
  month: number;
  fileName: string;
  mimeType: string;
  fileSize: number;
  uploadedByName: string | null;
  uploadedAt: Date;
};

export async function ensureSalarySlipTable() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "SalarySlip" (
      "id" UUID PRIMARY KEY,
      "employeeId" UUID NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
      "year" INTEGER NOT NULL,
      "month" INTEGER NOT NULL CHECK ("month" BETWEEN 1 AND 12),
      "fileName" TEXT NOT NULL,
      "mimeType" TEXT NOT NULL,
      "fileData" BYTEA NOT NULL,
      "uploadedById" UUID,
      "uploadedByName" TEXT,
      "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await prisma.$executeRawUnsafe(`
    ALTER TABLE "SalarySlip"
    DROP CONSTRAINT IF EXISTS "SalarySlip_employeeId_year_month_key"
  `);
  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "SalarySlip_employeeId_year_month_idx"
    ON "SalarySlip" ("employeeId", "year", "month")
  `);
}

export function isValidSalarySlipYear(value: number) {
  return Number.isInteger(value) && value >= 2000 && value <= 2100;
}

export function isValidSalarySlipMonth(value: number) {
  return Number.isInteger(value) && value >= 1 && value <= 12;
}

export function isSalarySlipMimeType(value: string): value is (typeof SALARY_SLIP_MIME_TYPES)[number] {
  return SALARY_SLIP_MIME_TYPES.includes(value as (typeof SALARY_SLIP_MIME_TYPES)[number]);
}

export function getSalarySlipMaxFileSize(mimeType: string) {
  return mimeType === "application/pdf" ? SALARY_SLIP_MAX_PDF_FILE_SIZE : SALARY_SLIP_MAX_IMAGE_FILE_SIZE;
}
