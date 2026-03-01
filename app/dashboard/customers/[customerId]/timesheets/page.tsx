import { redirect, notFound } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { DashboardHeader } from "@/components/dashboard-header"
import { TimesheetsContent } from "@/components/timesheets-content"
import { calculateMonthlyHours } from "@/lib/calculations"

interface TimesheetsPageProps {
  params: Promise<{ customerId: string }>
}

export default async function TimesheetsPage({ params }: TimesheetsPageProps) {
  const { customerId } = await params
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

  // Fetch timesheets for this customer
  const { data: timesheets } = await supabase
    .from("timesheets")
    .select("id, user_id, customer_id, month, year, status, created_at, updated_at")
    .eq("customer_id", customerId)
    .order("year", { ascending: false })
    .order("month", { ascending: false })

  // For each timesheet, get total hours
  const timesheetsWithHours = await Promise.all(
    (timesheets || []).map(async (timesheet) => {
      const { data: entries } = await supabase.from("time_entries").select("hours").eq("timesheet_id", timesheet.id)

      const totalHours = calculateMonthlyHours(entries || [])
      return { ...timesheet, total_hours: totalHours }
    }),
  )

  return (
    <div className="min-h-screen bg-muted/30">
      <DashboardHeader email={user.email || ""} />
      <TimesheetsContent customer={customer} initialTimesheets={timesheetsWithHours} userId={user.id} />
    </div>
  )
}
