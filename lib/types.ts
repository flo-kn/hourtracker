export type TimesheetStatus = "in_progress" | "completed"

export interface Customer {
  id: string
  user_id: string
  name: string
  booked_hours: number
  created_at: string
  updated_at: string
}

export interface Timesheet {
  id: string
  user_id: string
  customer_id: string
  month: number
  year: number
  status: TimesheetStatus
  created_at: string
  updated_at: string
  customer?: Customer
}

export interface TimeEntry {
  id: string
  user_id: string
  timesheet_id: string
  entry_date: string
  hours: number
  description: string | null
  on_site: boolean
  created_at: string
  updated_at: string
}

export interface CustomerWithStats extends Customer {
  total_hours_used: number
  hours_remaining: number
}
