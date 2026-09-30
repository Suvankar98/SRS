export const TASK_REVIEW_NOTE_PREFIX = "__TASK_REVIEW_NOTE__";

export type TaskReviewNote = {
  assignmentId: string;
  requestId: string;
  note: string;
};

export function encodeTaskReviewNote(value: TaskReviewNote) {
  return `${TASK_REVIEW_NOTE_PREFIX}${JSON.stringify(value)}`;
}

export function decodeTaskReviewNote(value: string): TaskReviewNote | null {
  if (!value.startsWith(TASK_REVIEW_NOTE_PREFIX)) {
    return null;
  }

  try {
    const parsed = JSON.parse(value.slice(TASK_REVIEW_NOTE_PREFIX.length)) as Partial<TaskReviewNote>;

    if (
      typeof parsed.assignmentId !== "string" ||
      typeof parsed.requestId !== "string" ||
      typeof parsed.note !== "string"
    ) {
      return null;
    }

    const note = parsed.note.trim();
    if (!note) {
      return null;
    }

    return {
      assignmentId: parsed.assignmentId,
      requestId: parsed.requestId,
      note,
    };
  } catch {
    return null;
  }
}

export function isTaskReviewNote(value: string) {
  return value.startsWith(TASK_REVIEW_NOTE_PREFIX);
}
