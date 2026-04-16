import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function getAttendanceStatus(attendance: string | undefined | null) {
  if (!attendance) return 'pending';
  const text = attendance.toLowerCase();
  if (/\bno\b/.test(text) || text.includes('no asist') || text.includes('no podr') || text.includes('no voy')) return 'not_attending';
  if (/\bs[íi]\b/.test(text) || text.includes('asist') || text.includes('confirm') || text.includes('voy')) return 'attending';
  return 'pending';
}
