export const TASK_REVIEW_NOTE_PREFIX = "__TASK_REVIEW_NOTE__";

export type TaskReviewNote = {
  assignmentId: string;
  requestId: string;
  note: string;
};

type DecodedTaskReviewNote = {
  assignmentId?: string;
  requestId: string;
  note: string;
};

export function encodeTaskReviewNote(value: TaskReviewNote) {
  return `${TASK_REVIEW_NOTE_PREFIX}${JSON.stringify(value)}`;
}

export function decodeTaskReviewNote(value: string): DecodedTaskReviewNote | null {
  const rawValue = value.trim();
  if (!rawValue) {
    return null;
  }

  try {
    const jsonValue = rawValue.startsWith(TASK_REVIEW_NOTE_PREFIX)
      ? rawValue.slice(TASK_REVIEW_NOTE_PREFIX.length)
      : rawValue;

    const parsed = JSON.parse(jsonValue) as Partial<TaskReviewNote> & {
      version?: unknown;
    };

    if (typeof parsed.requestId !== "string" || typeof parsed.note !== "string") {
      return null;
    }

    const note = parsed.note.trim();
    if (!note) {
      return null;
    }

    return {
      assignmentId: typeof parsed.assignmentId === "string" && parsed.assignmentId.trim()
        ? parsed.assignmentId.trim()
        : undefined,
      requestId: parsed.requestId.trim(),
      note,
    };
  } catch {
    return null;
  }
}

export function isTaskReviewNote(value: string) {
  return decodeTaskReviewNote(value) !== null;
}
