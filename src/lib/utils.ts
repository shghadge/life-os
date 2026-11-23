import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** `new Date("2026-08-15")` is UTC midnight, the previous day west of London; read plain dates as local midnight. */
function parseDate(dateString: string): Date {
  return new Date(/^\d{4}-\d{2}-\d{2}$/.test(dateString) ? `${dateString}T00:00` : dateString)
}

export function formatDate(dateString: string | undefined): string {
  if (!dateString) return "—"
  try {
    const date = parseDate(dateString)
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
    }).format(date)
  } catch {
    return dateString
  }
}

export function formatFullDate(dateString: string | undefined): string {
  if (!dateString) return "—"
  try {
    const date = parseDate(dateString)
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(date)
  } catch {
    return dateString
  }
}

export function formatDateTime(dateString: string | undefined): string {
  if (!dateString) return "—"
  try {
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }).format(new Date(dateString))
  } catch {
    return dateString
  }
}

export function formatRelativeTime(dateString: string | undefined): string {
  if (!dateString) return ""
  try {
    const now = new Date()
    const date = parseDate(dateString)
    const diffInMs = now.getTime() - date.getTime()
    const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24))
    
    if (diffInDays === 0) return "Today"
    if (diffInDays === 1) return "Yesterday"
    if (diffInDays < 7) return `${diffInDays}d ago`
    if (diffInDays < 30) return `${Math.floor(diffInDays / 7)}w ago`
    return `${Math.floor(diffInDays / 30)}mo ago`
  } catch {
    return ""
  }
}

export function formatCurrency(amount: number | undefined): string {
  if (amount === undefined || isNaN(amount)) return "—"
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(amount)
}
