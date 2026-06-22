/**
 * Get the CSS class for a status pill based on the status value
 */
export function getStatusPillClass(status?: string | null): string {
  switch (status) {
    case "Cancel":
      return "bg-red-100 text-red-800 ring-red-300 dark:bg-red-950 dark:text-red-200 dark:ring-red-700";
    case "Visit & Reschedule":
      return "bg-yellow-100 text-yellow-800 ring-yellow-300 dark:bg-yellow-950 dark:text-yellow-200 dark:ring-yellow-700";
    case "Close":
      return "bg-green-100 text-green-800 ring-green-300 dark:bg-emerald-950 dark:text-emerald-200 dark:ring-emerald-700";
    case "Pending":
    default:
      return "bg-blue-100 text-blue-800 ring-blue-300 dark:bg-blue-950 dark:text-blue-200 dark:ring-blue-700";
  }
}
