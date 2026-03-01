import type { TimeEntry, CustomerWithStats } from "./types"

interface HoursEntry {
  hours: number | string
}

export function calculateMonthlyHours(entries: HoursEntry[]): number {
  return entries.reduce((sum, entry) => {
    const hours = typeof entry.hours === "string" ? Number.parseFloat(entry.hours) || 0 : entry.hours
    return sum + hours
  }, 0)
}

export function calculateTotalUsedHours(customers: CustomerWithStats[]): number {
  return customers.reduce((sum, c) => sum + c.total_hours_used, 0)
}

export function calculateTotalBookedHours(customers: CustomerWithStats[]): number {
  return customers.reduce((sum, c) => sum + Number(c.booked_hours), 0)
}

export function calculateTotalRemainingHours(customers: CustomerWithStats[]): number {
  return customers.reduce((sum, c) => sum + c.hours_remaining, 0)
}

export function calculateHoursRemaining(bookedHours: number, usedHours: number): number {
  return bookedHours - usedHours
}
