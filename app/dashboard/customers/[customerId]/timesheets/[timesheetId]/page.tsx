import { redirect, notFound } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { DashboardHeader } from "@/components/dashboard-header"
import { TimesheetEntriesContent } from "@/components/timesheet-entries-content"

interface TimesheetEntriesPageProps {
  params: Promise<{ customerId: string; timesheetId: string }>
}

export default async function TimesheetEntriesPage({ params }: TimesheetEntriesPageProps) {
  const { customerId, timesheetId } = await params
  const supabase = await createClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user) {
    redirect("/auth/login")
  }

  // Fetch customer
  const { data: customer, error: customerError } = await supabase
    .from("customers")
    .select("id, user_id, name, booked_hours, created_at, updated_at")
    .eq("id", customerId)
    .eq("user_id", user.id)
    .single()

  if (customerError || !customer) {
    notFound()
  }

  // Fetch timesheet
  const { data: timesheet, error: timesheetError } = await supabase
    .from("timesheets")
    .select("id, user_id, customer_id, month, year, status, created_at, updated_at")
    .eq("id", timesheetId)
    .eq("customer_id", customerId)
    .single()

  if (timesheetError || !timesheet) {
    notFound()
  }

  // Fetch time entries
  const { data: entries } = await supabase
    .from("time_entries")
    .select("id, user_id, timesheet_id, entry_date, hours, description, on_site, created_at, updated_at")
    .eq("timesheet_id", timesheetId)
    .order("entry_date")

  return (
    <div className="min-h-screen bg-muted/30">
      <DashboardHeader email={user.email || ""} />
      <TimesheetEntriesContent
        customer={customer}
        timesheet={timesheet}
        initialEntries={entries || []}
        userId={user.id}
      />
    </div>
  )
}
