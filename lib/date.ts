// lib/utils/date.ts
export function formatDate(date: string | Date | null | undefined): string {
  if (!date) return 'N/A';
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return 'Invalid date';
  // Use a consistent format: "MMM dd, yyyy" (e.g., "Apr 8, 2026")
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC', // ✅ force UTC to avoid timezone shifting
  });
}

export function formatDateShort(date: string | Date | null | undefined): string {
  if (!date) return 'N/A';
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return 'Invalid date';
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
}