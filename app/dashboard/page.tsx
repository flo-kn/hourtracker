import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { DashboardHeader } from "@/components/dashboard-header"
import { DashboardContent } from "@/components/dashboard-content"
import { calculateMonthlyHours, calculateHoursRemaining } from "@/lib/calculations"

export default async function DashboardPage() {
  const supabase = await createClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user) {
    redirect("/auth/login")
  }

  // Get current year
  const currentYear = new Date().getFullYear()

  // Fetch customers with their total hours used this year
  const { data: customers } = await supabase
    .from("customers")
    .select("id, user_id, name, booked_hours, created_at, updated_at")
    .eq("user_id", user.id)
    .order("name")

  // For each customer, calculate total hours used this year
  const customersWithStats = await Promise.all(
    (customers || []).map(async (customer) => {
      const { data: timesheets } = await supabase
        .from("timesheets")
        .select("id")
        .eq("customer_id", customer.id)
        .eq("year", currentYear)

      const timesheetIds = timesheets?.map((t) => t.id) || []

      let totalHoursUsed = 0
      if (timesheetIds.length > 0) {
        const { data: entries } = await supabase.from("time_entries").select("hours").in("timesheet_id", timesheetIds)

        totalHoursUsed = calculateMonthlyHours(entries || [])
      }

      return {
        ...customer,
        total_hours_used: totalHoursUsed,
        hours_remaining: calculateHoursRemaining(Number(customer.booked_hours), totalHoursUsed),
      }
    }),
  )

  return (
    <div className="min-h-screen bg-muted/30">
      <DashboardHeader email={user.email || ""} />
      <DashboardContent initialCustomers={customersWithStats} userId={user.id} currentYear={currentYear} />
    </div>
  )
}
