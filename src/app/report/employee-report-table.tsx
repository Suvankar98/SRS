import type {
  EmployeeReportCompanyDocket,
  EmployeeReportPointCell,
  EmployeeReportRow,
} from "@/lib/employee-report";
import { EmployeeReportDownloadButton } from "./employee-report-download-button";

const DAY_WISE_MAX_POINTS = 20;

export function EmployeeReportTable({
  employeeName,
  rows,
  totalPoints,
}: {
  employeeName: string;
  rows: EmployeeReportRow[];
  totalPoints: number;
}) {
  const pdfRows = rows.map((row) => ({
    companyDocket: formatCompanyDocketsForExport(row.companyDockets),
    date: formatEmployeeReportDate(row.date),
    workSubmission: formatEmployeeReportPoint(row.workSubmission),
    attendance: `IN ${formatEmployeeReportPoint(row.attendanceIn)} / OUT ${formatEmployeeReportPoint(row.attendanceOut)}`,
    review: formatEmployeeReportPoint(row.review),
    documentSubmission: formatEmployeeReportPoint(row.documentSubmission),
    materialHandover: formatEmployeeReportPoint(row.materialHandover),
    dayTotal: formatPointDelta(getEmployeeReportDayTotal(row)),
  }));

  return (
    <section className="overflow-hidden rounded-2xl border border-blue-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-blue-100 bg-blue-50 px-4 py-3">
        <div>
          <h2 className="text-base font-semibold text-blue-950">{employeeName} Report</h2>
          <p className="mt-0.5 text-xs text-blue-600">Work submission and performance points summary</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <EmployeeReportDownloadButton employeeName={employeeName} totalPoints={totalPoints} rows={pdfRows} />
          <div className="rounded-lg border border-blue-200 bg-white px-3 py-2 text-sm font-semibold text-blue-900">
            Total Points: {totalPoints}
          </div>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="px-4 py-8 text-center text-sm text-blue-700">
          No report entries available yet.
        </div>
      ) : (
        <>
          <div className="space-y-3 p-3 md:hidden">
            {rows.map((row) => (
              <article key={row.id} className="rounded-xl border border-blue-100 bg-white p-3 text-xs text-blue-900 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-blue-500">Company Name / Docket Number</p>
                    <EmployeeReportCompanyDockets companyDockets={row.companyDockets} />
                  </div>
                  <EmployeeReportPointBadge label="Work Submission" value={row.workSubmission} />
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
                  <EmployeeReportMobileField label="Date" value={formatEmployeeReportDate(row.date)} />
                  <EmployeeReportAttendancePointField attendanceIn={row.attendanceIn} attendanceOut={row.attendanceOut} />
                  <EmployeeReportPointField label="Review" value={row.review} />
                  <EmployeeReportPointField label="Documents Submission" value={row.documentSubmission} />
                  <EmployeeReportPointField label="Material Handover" value={row.materialHandover} />
                  <EmployeeReportDayWiseField value={getEmployeeReportDayTotal(row)} />
                </div>
              </article>
            ))}
          </div>

          <div className="hidden overflow-x-auto md:block">
            <table className="min-w-[980px] w-full table-auto divide-y divide-blue-100 text-left text-xs">
              <thead className="bg-white text-blue-700">
                <tr>
                  <EmployeeReportTh>Company Name / Docket Number</EmployeeReportTh>
                  <EmployeeReportTh>Date</EmployeeReportTh>
                  <EmployeeReportTh>Work Submission</EmployeeReportTh>
                  <EmployeeReportTh>Attendance</EmployeeReportTh>
                  <EmployeeReportTh>Review</EmployeeReportTh>
                  <EmployeeReportTh>Documents Submission</EmployeeReportTh>
                  <EmployeeReportTh>Material Handover</EmployeeReportTh>
                  <EmployeeReportTh>Day Wise Total</EmployeeReportTh>
                </tr>
              </thead>
              <tbody className="divide-y divide-blue-100 bg-white">
                {rows.map((row) => (
                  <tr key={row.id} className="align-top">
                    <td className="px-3 py-3 text-blue-950">
                      <EmployeeReportCompanyDockets companyDockets={row.companyDockets} />
                    </td>
                    <td className="px-3 py-3 font-medium text-blue-900">{formatEmployeeReportDate(row.date)}</td>
                    <EmployeeReportPointTd value={row.workSubmission} />
                    <EmployeeReportAttendancePointTd attendanceIn={row.attendanceIn} attendanceOut={row.attendanceOut} />
                    <EmployeeReportPointTd value={row.review} />
                    <EmployeeReportPointTd value={row.documentSubmission} />
                    <EmployeeReportPointTd value={row.materialHandover} />
                    <td className="px-3 py-3">
                      <EmployeeReportDayWiseBadge value={getEmployeeReportDayTotal(row)} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}

function EmployeeReportTh({ children }: { children: React.ReactNode }) {
  return (
    <th className="px-3 py-2.5 text-[11px] font-extrabold uppercase tracking-[0.12em] text-blue-800">
      {children}
    </th>
  );
}

function EmployeeReportCompanyDockets({ companyDockets }: { companyDockets: EmployeeReportCompanyDocket[] }) {
  if (companyDockets.length === 0) {
    return <p className="font-semibold text-blue-950">-</p>;
  }

  return (
    <div className="space-y-2">
      {companyDockets.map((entry) => (
        <div key={`${entry.companyName}-${entry.docketNumber}`}>
          <p className="break-words font-semibold text-blue-950">{entry.companyName}</p>
          <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.1em] text-blue-500">{entry.docketNumber}</p>
        </div>
      ))}
    </div>
  );
}

function EmployeeReportMobileField({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-blue-100 bg-blue-50/60 px-2.5 py-2">
      <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-blue-500">{label}</p>
      <p className="mt-1 break-words font-semibold text-blue-950">{value}</p>
    </div>
  );
}

function EmployeeReportPointField({ label, value }: { label: string; value: EmployeeReportPointCell }) {
  return (
    <div className="rounded-lg border border-blue-100 bg-blue-50/60 px-2.5 py-2">
      <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-blue-500">{label}</p>
      <p className="mt-1 break-words font-semibold text-blue-950">{formatEmployeeReportPoint(value)}</p>
    </div>
  );
}

function EmployeeReportDayWiseField({ value }: { value: number }) {
  return (
    <div className="rounded-lg border border-blue-100 bg-blue-50/60 px-2.5 py-2">
      <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-blue-500">Day Wise Total</p>
      <div className="mt-1">
        <EmployeeReportDayWiseBadge value={value} />
      </div>
    </div>
  );
}

function EmployeeReportDayWiseBadge({ value }: { value: number }) {
  const grade = getDayWiseGrade(value);

  return (
    <span className={`inline-flex min-w-20 items-center justify-center rounded-full border px-3 py-1 text-xs font-extrabold ${grade.className}`}>
      {formatPointDelta(value)}
    </span>
  );
}

function EmployeeReportAttendancePointField({
  attendanceIn,
  attendanceOut,
}: {
  attendanceIn: EmployeeReportPointCell;
  attendanceOut: EmployeeReportPointCell;
}) {
  return (
    <div className="rounded-lg border border-blue-100 bg-blue-50/60 px-2.5 py-2">
      <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-blue-500">Attendance</p>
      <EmployeeReportAttendanceLines attendanceIn={attendanceIn} attendanceOut={attendanceOut} />
    </div>
  );
}

function EmployeeReportPointBadge({ label, value }: { label: string; value: EmployeeReportPointCell }) {
  return (
    <div className="shrink-0 rounded-lg bg-blue-50 px-2.5 py-1 text-right">
      <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-blue-500">{label}</p>
      <p className="font-semibold text-blue-950">{formatEmployeeReportPoint(value)}</p>
    </div>
  );
}

function EmployeeReportPointTd({ value }: { value: EmployeeReportPointCell }) {
  return (
    <td className="px-3 py-3 text-blue-900">
      <p className="font-semibold text-blue-950">{formatEmployeeReportPoint(value)}</p>
    </td>
  );
}

function EmployeeReportAttendancePointTd({
  attendanceIn,
  attendanceOut,
}: {
  attendanceIn: EmployeeReportPointCell;
  attendanceOut: EmployeeReportPointCell;
}) {
  return (
    <td className="px-3 py-3 text-blue-900">
      <EmployeeReportAttendanceLines attendanceIn={attendanceIn} attendanceOut={attendanceOut} />
    </td>
  );
}

function EmployeeReportAttendanceLines({
  attendanceIn,
  attendanceOut,
}: {
  attendanceIn: EmployeeReportPointCell;
  attendanceOut: EmployeeReportPointCell;
}) {
  return (
    <div className="grid w-fit min-w-24 grid-cols-2 gap-x-4 text-center">
      <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-blue-500">IN</p>
      <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-blue-500">OUT</p>
      <p className="mt-1 font-semibold text-blue-950">{formatEmployeeReportPoint(attendanceIn)}</p>
      <p className="mt-1 font-semibold text-blue-950">{formatEmployeeReportPoint(attendanceOut)}</p>
    </div>
  );
}

function formatEmployeeReportDate(value: Date | null) {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(value);
}

function getEmployeeReportDayTotal(row: EmployeeReportRow) {
  return (
    (row.workSubmission.points ?? 0) +
    (row.attendanceIn.points ?? 0) +
    (row.attendanceOut.points ?? 0) +
    (row.review.points ?? 0) +
    (row.documentSubmission.points ?? 0) +
    (row.materialHandover.points ?? 0)
  );
}

function formatCompanyDocketsForExport(companyDockets: EmployeeReportCompanyDocket[]) {
  if (companyDockets.length === 0) {
    return "-";
  }

  return companyDockets.map((entry) => `${entry.companyName} / ${entry.docketNumber}`).join("; ");
}

function formatPointDelta(value: number | null) {
  if (typeof value !== "number") {
    return "-";
  }

  return value > 0 ? `+${value}` : String(value);
}

function formatEmployeeReportPoint(value: EmployeeReportPointCell) {
  return formatPointDelta(value.points);
}

function getDayWiseGrade(value: number) {
  const percentage = Math.max(0, Math.min(100, (value / DAY_WISE_MAX_POINTS) * 100));

  if (percentage >= 91) {
    return { className: "border-emerald-200 bg-emerald-100 text-emerald-800" };
  }

  if (percentage >= 81) {
    return { className: "border-amber-200 bg-amber-100 text-amber-800" };
  }

  if (percentage >= 71) {
    return { className: "border-red-200 bg-red-100 text-red-800" };
  }

  return { className: "border-slate-200 bg-slate-100 text-slate-700" };
}
