"use client";

import { useMemo, useState, useTransition } from "react";

import { addEmployeePerformanceAdjustment } from "../actions";
import {
  ATTENDANCE_POINTS,
  DOCUMENT_SUBMISSION_POINTS,
  MATERIAL_HANDOVER_POINTS,
  REVIEW_POINTS,
  TEAMWORK_POINTS,
  type AttendanceOption,
  type DocumentSubmissionOption,
  type MaterialHandoverOption,
  type ReviewOption,
  type TeamworkOption,
} from "@/lib/employee-performance-rules";

type EmployeePointsPopupProps = {
  employeeId: string;
  employeeName: string;
  currentPoints: number;
};

const ATTENDANCE_OPTIONS = Object.entries(ATTENDANCE_POINTS) as Array<
  [AttendanceOption, (typeof ATTENDANCE_POINTS)[AttendanceOption]]
>;
const REVIEW_OPTIONS = Object.entries(REVIEW_POINTS) as Array<[ReviewOption, (typeof REVIEW_POINTS)[ReviewOption]]>;
const DOCUMENT_OPTIONS = Object.entries(DOCUMENT_SUBMISSION_POINTS) as Array<
  [DocumentSubmissionOption, (typeof DOCUMENT_SUBMISSION_POINTS)[DocumentSubmissionOption]]
>;
const MATERIAL_OPTIONS = Object.entries(MATERIAL_HANDOVER_POINTS) as Array<
  [MaterialHandoverOption, (typeof MATERIAL_HANDOVER_POINTS)[MaterialHandoverOption]]
>;
const TEAMWORK_OPTIONS = Object.entries(TEAMWORK_POINTS) as Array<[TeamworkOption, (typeof TEAMWORK_POINTS)[TeamworkOption]]>;

export function EmployeePointsPopup({ employeeId, employeeName, currentPoints }: EmployeePointsPopupProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [errorMessage, setErrorMessage] = useState("");
  const todayInputValue = useMemo(() => getTodayInputValue(), []);

  const [attendanceOption, setAttendanceOption] = useState<AttendanceOption | "">("");
  const [reviewOption, setReviewOption] = useState<ReviewOption | "">("");
  const [documentSubmissionOption, setDocumentSubmissionOption] = useState<DocumentSubmissionOption | "">("");
  const [materialHandoverOption, setMaterialHandoverOption] = useState<MaterialHandoverOption | "">("");
  const [teamworkOption, setTeamworkOption] = useState<TeamworkOption | "">("");
  const [adjustmentDate, setAdjustmentDate] = useState(todayInputValue);

  const allChosen =
    attendanceOption !== "" &&
    reviewOption !== "" &&
    documentSubmissionOption !== "" &&
    materialHandoverOption !== "" &&
    teamworkOption !== "";

  const totalDelta = useMemo(() => {
    return (
      (attendanceOption === "" ? 0 : ATTENDANCE_POINTS[attendanceOption].points) +
      (reviewOption === "" ? 0 : REVIEW_POINTS[reviewOption].points) +
      (documentSubmissionOption === "" ? 0 : DOCUMENT_SUBMISSION_POINTS[documentSubmissionOption].points) +
      (materialHandoverOption === "" ? 0 : MATERIAL_HANDOVER_POINTS[materialHandoverOption].points) +
      (teamworkOption === "" ? 0 : TEAMWORK_POINTS[teamworkOption].points)
    );
  }, [attendanceOption, reviewOption, documentSubmissionOption, materialHandoverOption, teamworkOption]);

  const projectedPoints = currentPoints + totalDelta;

  const submitPoints = () => {
    if (!allChosen) {
      setErrorMessage("Please choose an option in every dropdown.");
      return;
    }

    setErrorMessage("");

    startTransition(async () => {
      try {
        const formData = new FormData();
        formData.append("employeeId", employeeId);
        formData.append("attendanceOption", attendanceOption);
        formData.append("reviewOption", reviewOption);
        formData.append("documentSubmissionOption", documentSubmissionOption);
        formData.append("materialHandoverOption", materialHandoverOption);
        formData.append("teamworkOption", teamworkOption);
        formData.append("adjustmentDate", adjustmentDate);

        await addEmployeePerformanceAdjustment(formData);

        setIsOpen(false);
        window.location.reload();
      } catch (error) {
        setErrorMessage(error instanceof Error ? error.message : "Unable to update points.");
      }
    });
  };

  const closeModal = () => {
    if (isPending) {
      return;
    }

    setIsOpen(false);
    setErrorMessage("");
  };

  const resetSelections = () => {
    if (isPending) {
      return;
    }

    setAttendanceOption("");
    setReviewOption("");
    setDocumentSubmissionOption("");
    setMaterialHandoverOption("");
    setTeamworkOption("");
    setAdjustmentDate(todayInputValue);
    setErrorMessage("");
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="inline-flex items-center justify-center rounded-full border border-blue-300 bg-blue-50 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-blue-700 transition hover:bg-blue-100"
      >
        Update Tag
      </button>

      {isOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-950/45 p-4"
          onClick={closeModal}
        >
          <div
            className="my-6 w-full max-w-xl rounded-3xl border border-blue-200 bg-white p-5 shadow-[0_28px_90px_rgba(15,23,42,0.18)] sm:p-6"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-blue-600">Employee Performance Tag</p>
                  <label className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.1em] text-blue-700">
                    <span>Date</span>
                    <input
                      type="date"
                      value={adjustmentDate}
                      max={todayInputValue}
                      onChange={(event) => setAdjustmentDate(event.target.value)}
                      className="rounded-lg border border-blue-200 bg-blue-50 px-2 py-1 text-xs font-medium normal-case tracking-normal text-blue-900 outline-none focus:border-blue-400"
                    />
                  </label>
                </div>
                <h3 className="mt-1 text-xl font-semibold text-blue-950">{employeeName}</h3>
                <p className="mt-1 text-sm text-blue-700">Current monthly points: {currentPoints}</p>
              </div>
              <button
                type="button"
                onClick={closeModal}
                className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-blue-200 text-blue-700 transition hover:bg-blue-50"
                aria-label="Close"
              >
                x
              </button>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <SelectField
                label="Attendance"
                value={attendanceOption}
                onChange={(value) => setAttendanceOption(value as AttendanceOption)}
                options={ATTENDANCE_OPTIONS}
              />
              <SelectField
                label="Review"
                value={reviewOption}
                onChange={(value) => setReviewOption(value as ReviewOption)}
                options={REVIEW_OPTIONS}
              />
              <SelectField
                label="Document Submission"
                value={documentSubmissionOption}
                onChange={(value) => setDocumentSubmissionOption(value as DocumentSubmissionOption)}
                options={DOCUMENT_OPTIONS}
              />
              <SelectField
                label="Material Handover"
                value={materialHandoverOption}
                onChange={(value) => setMaterialHandoverOption(value as MaterialHandoverOption)}
                options={MATERIAL_OPTIONS}
              />
              <SelectField
                label="Teamwork"
                value={teamworkOption}
                onChange={(value) => setTeamworkOption(value as TeamworkOption)}
                options={TEAMWORK_OPTIONS}
                className="sm:col-span-2"
              />
            </div>

            <div className="mt-5 rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3">
              <p className="text-sm font-medium text-blue-800">Adjustment Total: {totalDelta >= 0 ? `+${totalDelta}` : totalDelta}</p>
              <p className="text-xs text-blue-700">
                {allChosen ? `Projected monthly points after save: ${projectedPoints}` : "Choose all dropdown values to calculate final points."}
              </p>
            </div>

            {errorMessage ? <p className="mt-3 text-sm text-rose-700">{errorMessage}</p> : null}

            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={resetSelections}
                className="inline-flex items-center justify-center rounded-xl border border-blue-300 bg-white px-3 py-2 text-sm font-medium text-blue-700 transition hover:bg-blue-50"
                disabled={isPending}
              >
                Reset
              </button>
              <button
                type="button"
                onClick={closeModal}
                className="inline-flex items-center justify-center rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                disabled={isPending}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={submitPoints}
                className="inline-flex items-center justify-center rounded-xl bg-blue-700 px-3 py-2 text-sm font-medium text-white transition hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-70"
                disabled={isPending || !allChosen}
              >
                {isPending ? "Saving..." : "Save Points"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

function getTodayInputValue() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function SelectField<T extends string>({
  label,
  value,
  onChange,
  options,
  className,
}: {
  label: string;
  value: T | "";
  onChange: (value: string) => void;
  options: Array<[T, { label: string; points: number }]>;
  className?: string;
}) {
  return (
    <label className={`grid gap-1 ${className ?? ""}`.trim()}>
      <span className="text-xs font-semibold uppercase tracking-[0.1em] text-blue-700">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-xl border border-blue-200 bg-white px-3 py-2 text-sm text-blue-900 outline-none focus:border-blue-400"
      >
        <option value="">Choose</option>
        {options.map(([optionValue, option]) => (
          <option key={optionValue} value={optionValue}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}
