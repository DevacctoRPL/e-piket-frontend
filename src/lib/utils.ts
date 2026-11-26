import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Hanya izinkan redirect ke path internal yang aman (cegah open redirect dan loop login). */
export function safeNextPath(next: string | null): string {
  if (!next || !next.startsWith('/') || next.startsWith('//') || next.startsWith('/\\')) return '/'
  if (next === '/login' || next.startsWith('/login?') || next.startsWith('/login#')) return '/'
  return next
}
