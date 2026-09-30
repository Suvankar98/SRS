"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { saveEmployeePerformanceTag } from "./save-employee-performance-tag";
import { ATTENDANCE_IN_POINTS, ATTENDANCE_OUT_POINTS, DOCUMENT_SUBMISSION_POINTS, MATERIAL_HANDOVER_POINTS, REVIEW_POINTS, type AttendanceInOption, type AttendanceOutOption, type DocumentSubmissionOption, type MaterialHandoverOption, type ReviewOption } from "@/lib/employee-performance-rules";
import { decodeTaskReviewNote } from "@/lib/employee-review-notes";
import { formatPerformancePoints, formatPointDelta } from "@/lib/points";

type EmployeePerformanceTask = { id: string; requestId: string; docketNumber: string; company: string; name: string; assignedAt: string };
type EmployeePointsPopupProps = { employeeId: string; employeeName: string; currentPoints: number; pointAdjustments: EmployeePerformanceAdjustment[]; performanceTasks?: EmployeePerformanceTask[] };
type EmployeePerformanceAdjustment = { id: string; attendanceOption: string; attendancePoints: number; reviewOption: string; reviewPoints: number; teamworkOption: string; documentSubmissionOption: string; documentSubmissionPoints: number; materialHandoverOption: string; materialHandoverPoints: number; totalDelta: number; createdAt: string };
type SavedDailyAdjustment = { attendanceInOption: AttendanceInOption | ""; attendanceOutOption: AttendanceOutOption | ""; reviewOption: ReviewOption | ""; reviewNote: string; documentSubmissionOption: DocumentSubmissionOption | ""; materialHandoverOption: MaterialHandoverOption | ""; totalDelta: number };

const ATTENDANCE_IN_OPTIONS = Object.entries(ATTENDANCE_IN_POINTS) as Array<[AttendanceInOption, (typeof ATTENDANCE_IN_POINTS)[AttendanceInOption]]>;
const ATTENDANCE_OUT_OPTIONS = Object.entries(ATTENDANCE_OUT_POINTS) as Array<[AttendanceOutOption, (typeof ATTENDANCE_OUT_POINTS)[AttendanceOutOption]]>;
const REVIEW_OPTIONS = Object.entries(REVIEW_POINTS) as Array<[ReviewOption, (typeof REVIEW_POINTS)[ReviewOption]]>;
const DOCUMENT_OPTIONS = Object.entries(DOCUMENT_SUBMISSION_POINTS) as Array<[DocumentSubmissionOption, (typeof DOCUMENT_SUBMISSION_POINTS)[DocumentSubmissionOption]]>;
const MATERIAL_OPTIONS = Object.entries(MATERIAL_HANDOVER_POINTS) as Array<[MaterialHandoverOption, (typeof MATERIAL_HANDOVER_POINTS)[MaterialHandoverOption]]>;

export function EmployeePointsPopup({ employeeId, employeeName, currentPoints, pointAdjustments, performanceTasks = [] }: EmployeePointsPopupProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [errorMessage, setErrorMessage] = useState("");
  const [adjustmentDate, setAdjustmentDate] = useState(getTodayInputValue());
  const [assignmentId, setAssignmentId] = useState("");
  const [tasks, setTasks] = useState<EmployeePerformanceTask[]>(performanceTasks);
  const [loadingTasks, setLoadingTasks] = useState(true);
  const [attendanceInOption, setAttendanceInOption] = useState<AttendanceInOption | "">("");
  const [attendanceOutOption, setAttendanceOutOption] = useState<AttendanceOutOption | "">("");
  const [reviewOption, setReviewOption] = useState<ReviewOption | "">("");
  const [reviewNote, setReviewNote] = useState("");
  const [documentSubmissionOption, setDocumentSubmissionOption] = useState<DocumentSubmissionOption | "">("");
  const [materialHandoverOption, setMaterialHandoverOption] = useState<MaterialHandoverOption | "">("");
  const savedAdjustments = useMemo(() => buildSavedAdjustments(pointAdjustments), [pointAdjustments]);

  useEffect(() => {
    let cancelled = false;

    fetch(`/api/report/employee-tasks?employeeId=${encodeURIComponent(employeeId)}&date=${encodeURIComponent(adjustmentDate)}`, { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("Unable to load allotted tasks.");
        return response.json() as Promise<{ tasks: EmployeePerformanceTask[] }>;
      })
      .then((data) => {
        if (cancelled) return;
        const nextTasks = Array.isArray(data.tasks) ? data.tasks : [];
        setTasks(nextTasks);
        const savedTaskId = Array.from(savedAdjustments.keys()).find((key) => key.startsWith(`${adjustmentDate}|`))?.split("|")[1] ?? "";
        const nextId = nextTasks.some((task) => task.id === assignmentId) ? assignmentId : nextTasks.some((task) => task.id === savedTaskId) ? savedTaskId : nextTasks[0]?.id ?? "";
        setAssignmentId(nextId);
        applySaved(nextId, adjustmentDate, savedAdjustments, setAttendanceInOption, setAttendanceOutOption, setReviewOption, setReviewNote, setDocumentSubmissionOption, setMaterialHandoverOption);
      })
      .catch((error) => { if (!cancelled) setErrorMessage(error instanceof Error ? error.message : "Unable to load allotted tasks."); })
      .finally(() => { if (!cancelled) setLoadingTasks(false); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [employeeId, adjustmentDate, savedAdjustments]);

  const selectedTask = tasks.find((task) => task.id === assignmentId) ?? tasks[0];
  const totalDelta = useMemo(() => (attendanceInOption === "" ? 0 : ATTENDANCE_IN_POINTS[attendanceInOption].points) + (attendanceOutOption === "" ? 0 : ATTENDANCE_OUT_POINTS[attendanceOutOption].points) + (reviewOption === "" ? 0 : REVIEW_POINTS[reviewOption].points) + (documentSubmissionOption === "" ? 0 : DOCUMENT_SUBMISSION_POINTS[documentSubmissionOption].points) + (materialHandoverOption === "" ? 0 : MATERIAL_HANDOVER_POINTS[materialHandoverOption].points), [attendanceInOption, attendanceOutOption, reviewOption, documentSubmissionOption, materialHandoverOption]);

  const openModal = () => { setIsOpen(true); setErrorMessage(""); };
  const changeDate = (value: string) => { setLoadingTasks(true); setAdjustmentDate(value); setAssignmentId(""); setErrorMessage(""); };
  const changeAssignment = (value: string) => { setAssignmentId(value); applySaved(value, adjustmentDate, savedAdjustments, setAttendanceInOption, setAttendanceOutOption, setReviewOption, setReviewNote, setDocumentSubmissionOption, setMaterialHandoverOption); setErrorMessage(""); };

  const submitPoints = () => {
    if (!selectedTask) { setErrorMessage("No task was assigned to this employee by the selected date."); return; }
    startTransition(async () => {
      try {
        const formData = new FormData();
        formData.append("employeeId", employeeId); formData.append("assignmentId", selectedTask.id); formData.append("attendanceInOption", attendanceInOption); formData.append("attendanceOutOption", attendanceOutOption); formData.append("reviewOption", reviewOption); formData.append("reviewNote", reviewNote); formData.append("documentSubmissionOption", documentSubmissionOption); formData.append("materialHandoverOption", materialHandoverOption); formData.append("adjustmentDate", adjustmentDate);
        await saveEmployeePerformanceTag(formData); setIsOpen(false); window.location.reload();
      } catch (error) { setErrorMessage(error instanceof Error ? error.message : "Unable to update points."); }
    });
  };

  return <>
    <button type="button" onClick={openModal} className="inline-flex items-center justify-center gap-1.5 rounded-full border border-blue-200 bg-gradient-to-r from-blue-50 to-sky-50 px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.08em] text-blue-700 shadow-sm transition hover:border-blue-300 hover:bg-blue-100 focus:outline-none focus:ring-2 focus:ring-blue-200"><TagIcon />Update Tag</button>
    {isOpen ? <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-950/55 p-3 sm:p-5" onClick={() => !isPending && setIsOpen(false)}>
      <div className="my-auto w-full max-w-2xl overflow-hidden rounded-[1.5rem] border border-blue-100 bg-white shadow-[0_30px_100px_rgba(15,23,42,0.25)]" onClick={(event) => event.stopPropagation()}>
        <div className="border-b border-blue-100 bg-gradient-to-br from-blue-50 via-white to-sky-50 px-4 py-3 sm:px-5">
          <div className="flex items-start justify-between gap-4"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><span className="inline-flex items-center gap-1.5 rounded-full bg-blue-100 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-blue-700"><TagIcon />Employee Performance Tag</span><label className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.1em] text-blue-600">Date<input type="date" value={adjustmentDate} max={getTodayInputValue()} onChange={(event) => changeDate(event.target.value)} className="rounded-lg border border-blue-200 bg-white px-2.5 py-1.5 text-xs font-semibold normal-case tracking-normal text-blue-900 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100" /></label></div><h3 className="mt-2 text-xl font-bold tracking-tight text-slate-900">{employeeName}</h3><p className="mt-0.5 text-xs font-medium text-blue-600">Current monthly points: {formatPerformancePoints(currentPoints)}</p></div><button type="button" onClick={() => setIsOpen(false)} className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 transition hover:border-red-200 hover:bg-red-50 hover:text-red-600" aria-label="Close"><CloseIcon /></button></div>
        </div>
        <div className="space-y-3 p-4 sm:p-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <SelectField label="Attendance IN" value={attendanceInOption} onChange={(v) => setAttendanceInOption(v as AttendanceInOption)} options={ATTENDANCE_IN_OPTIONS} />
            <SelectField label="Attendance OUT" value={attendanceOutOption} onChange={(v) => setAttendanceOutOption(v as AttendanceOutOption)} options={ATTENDANCE_OUT_OPTIONS} />
            <SelectField label="Review" value={reviewOption} onChange={(v) => setReviewOption(v as ReviewOption)} options={REVIEW_OPTIONS} />
            <label className="grid gap-1.5">
              <span className="text-[11px] font-bold uppercase tracking-[0.1em] text-blue-700">Service Docket</span>
              <select value={selectedTask?.id ?? ""} onChange={(event) => changeAssignment(event.target.value)} disabled={loadingTasks || tasks.length === 0} className="w-full rounded-xl border border-blue-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-800 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400">
                <option value="">{loadingTasks ? "Loading allotted tasks…" : tasks.length ? "Choose task / docket" : "No task assigned by this date"}</option>
                {tasks.map((task) => <option key={task.id} value={task.id}>{task.docketNumber} — {task.company}{task.name ? ` / ${task.name}` : ""}</option>)}
              </select>
              
            </label>
            <label className="grid gap-1.5 sm:col-span-2">
              <span className="text-[11px] font-bold uppercase tracking-[0.1em] text-blue-700">Review Note</span>
              <textarea value={reviewNote} onChange={(event) => setReviewNote(event.target.value)} rows={2} maxLength={1000} placeholder="Write review details for this specific docket..." className="min-h-16 w-full resize-none rounded-xl border border-blue-200 bg-white px-3 py-3 text-sm leading-relaxed text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:ring-4 focus:ring-blue-100" />
              <span className="text-right text-[10px] text-slate-400">{reviewNote.length}/1000</span>
            </label>
            <SelectField label="Document Submission" value={documentSubmissionOption} onChange={(v) => setDocumentSubmissionOption(v as DocumentSubmissionOption)} options={DOCUMENT_OPTIONS} />
            <SelectField label="Material Handover" value={materialHandoverOption} onChange={(v) => setMaterialHandoverOption(v as MaterialHandoverOption)} options={MATERIAL_OPTIONS} />
          </div>
          <div className="flex items-center justify-between gap-3 rounded-2xl border border-blue-100 bg-blue-50/70 px-3 py-2"><div><p className="text-[10px] font-bold uppercase tracking-[0.14em] text-blue-600">Points for selected task</p><p className="mt-0.5 text-sm font-semibold text-blue-950">Today’s Point: {formatPointDelta(totalDelta)}</p></div>{selectedTask ? <span className="max-w-[50%] truncate rounded-full bg-white px-3 py-1.5 text-[10px] font-semibold text-blue-700 ring-1 ring-inset ring-blue-100">{selectedTask.docketNumber}</span> : null}</div>
          {errorMessage ? <p className="rounded-xl border border-red-100 bg-red-50 px-3 py-2.5 text-sm text-red-700">{errorMessage}</p> : null}
          <div className="flex items-center justify-end gap-2 border-t border-slate-100 pt-3"><button type="button" onClick={() => setIsOpen(false)} className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50" disabled={isPending}>Cancel</button><button type="button" onClick={submitPoints} className="inline-flex items-center justify-center rounded-xl bg-blue-700 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-60" disabled={isPending}>{isPending ? "Saving..." : "Save Performance Tag"}</button></div>
        </div>
      </div>
    </div> : null}
  </>;
}

function applySaved(assignmentId: string, date: string, saved: Map<string, SavedDailyAdjustment>, setIn: (v: AttendanceInOption | "") => void, setOut: (v: AttendanceOutOption | "") => void, setReview: (v: ReviewOption | "") => void, setNote: (v: string) => void, setDoc: (v: DocumentSubmissionOption | "") => void, setMaterial: (v: MaterialHandoverOption | "") => void) {
  const value = saved.get(`${date}|${assignmentId}`);
  setIn(value?.attendanceInOption ?? ""); setOut(value?.attendanceOutOption ?? ""); setReview(value?.reviewOption ?? ""); setNote(value?.reviewNote ?? ""); setDoc(value?.documentSubmissionOption ?? ""); setMaterial(value?.materialHandoverOption ?? "");
}

function buildSavedAdjustments(adjustments: EmployeePerformanceAdjustment[]) {
  const saved = new Map<string, SavedDailyAdjustment>();
  for (const adjustment of adjustments) {
    const taskNote = decodeTaskReviewNote(adjustment.teamworkOption);
    if (!taskNote?.assignmentId) continue;
    const attendance = parseAttendance(adjustment.attendanceOption);
    saved.set(`${getDateInputValue(adjustment.createdAt)}|${taskNote.assignmentId}`, { attendanceInOption: attendance.inOption, attendanceOutOption: attendance.outOption, reviewOption: getOptionValue(adjustment.reviewOption, REVIEW_OPTIONS), reviewNote: taskNote.note, documentSubmissionOption: getOptionValue(adjustment.documentSubmissionOption, DOCUMENT_OPTIONS), materialHandoverOption: getOptionValue(adjustment.materialHandoverOption, MATERIAL_OPTIONS), totalDelta: adjustment.totalDelta });
  }
  return saved;
}

function parseAttendance(value: string) { try { const parsed = JSON.parse(value) as { inOption?: unknown; outOption?: unknown }; return { inOption: getOptionValue(typeof parsed.inOption === "string" ? parsed.inOption : "", ATTENDANCE_IN_OPTIONS) as AttendanceInOption | "", outOption: getOptionValue(typeof parsed.outOption === "string" ? parsed.outOption : "", ATTENDANCE_OUT_OPTIONS) as AttendanceOutOption | "" }; } catch { return { inOption: "" as AttendanceInOption | "", outOption: "" as AttendanceOutOption | "" }; } }
function getOptionValue<T extends string>(value: string, options: Array<[T, { label: string; points: number }]>) { return options.find(([key, option]) => key === value || option.label === value)?.[0] ?? ""; }
function getTodayInputValue() { return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date()); }
function getDateInputValue(value: string) { return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(value)); }
function SelectField<T extends string>({ label, value, onChange, options }: { label: string; value: T | ""; onChange: (value: string) => void; options: Array<[T, { label: string; points: number }]> }) { return <label className="grid gap-1.5"><span className="text-[11px] font-bold uppercase tracking-[0.1em] text-blue-700">{label}</span><select value={value} onChange={(event) => onChange(event.target.value)} className="w-full rounded-xl border border-blue-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-800 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-100"><option value="">Choose</option>{options.map(([key, option]) => <option key={key} value={key}>{option.label}</option>)}</select></label>; }
function TagIcon() { return <svg viewBox="0 0 20 20" fill="none" className="h-3.5 w-3.5" aria-hidden="true"><path d="M3.5 5.25A1.75 1.75 0 0 1 5.25 3.5H11l5.5 5.5-6.5 6.5a1.75 1.75 0 0 1-2.475 0L3.5 11.475V5.25Z" stroke="currentColor" strokeWidth="1.5"/><circle cx="7" cy="7" r="1" fill="currentColor"/></svg>; }
function CloseIcon() { return <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5" aria-hidden="true"><path d="M6.28 5.22a.75.75 0 0 1 1.06 0L10 7.88l2.66-2.66a.75.75 0 1 1 1.06 1.06L11.06 8.94l2.66 2.66a.75.75 0 0 1-1.06 1.06L10 10l-2.66 2.66a.75.75 0 1 1-1.06-1.06l2.66-2.66-2.66-2.66a.75.75 0 0 1 0-1.06Z"/></svg>; }
