"use client"

import { useState, useMemo } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { ArrowLeft, Save, Clock, Lock, Unlock, CheckCircle2, AlertTriangle, FileDown } from "lucide-react"
import Link from "next/link"
import type { Customer, Timesheet, TimeEntry, TimesheetStatus } from "@/lib/types"
import { generateTimesheetPDF } from "@/lib/pdf-export"
import { calculateMonthlyHours } from "@/lib/calculations"

interface TimesheetEntriesContentProps {
  customer: Customer
  timesheet: Timesheet
  initialEntries: TimeEntry[]
  userId: string
}

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
]

const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"]

interface DayEntry {
  date: Date
  dayOfMonth: number
  dayOfWeek: string
  isWeekend: boolean
  entry: TimeEntry | null
  hours: string
  description: string
  onSite: boolean
  isDirty: boolean
}

export function TimesheetEntriesContent({ customer, timesheet, initialEntries, userId }: TimesheetEntriesContentProps) {
  const router = useRouter()
  const [isSaving, setIsSaving] = useState(false)
  const [savedMessage, setSavedMessage] = useState("")
  const [status, setStatus] = useState<TimesheetStatus>(timesheet.status)
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false)
  const [isExporting, setIsExporting] = useState(false)

  const isLocked = status === "completed"

  const daysInMonth = useMemo(() => {
    const year = timesheet.year
    const month = timesheet.month - 1
    const numDays = new Date(year, month + 1, 0).getDate()

    const days: DayEntry[] = []
    for (let day = 1; day <= numDays; day++) {
      const date = new Date(year, month, day)
      const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`
      const existingEntry = initialEntries.find((e) => e.entry_date === dateStr)

      days.push({
        date,
        dayOfMonth: day,
        dayOfWeek: WEEKDAYS[date.getDay()],
        isWeekend: date.getDay() === 0 || date.getDay() === 6,
        entry: existingEntry || null,
        hours: existingEntry ? existingEntry.hours.toString() : "",
        description: existingEntry?.description || "",
        onSite: existingEntry?.on_site || false,
        isDirty: false,
      })
    }
    return days
  }, [timesheet, initialEntries])

  const [entries, setEntries] = useState<DayEntry[]>(daysInMonth)

  const totalHours = calculateMonthlyHours(entries)

  const totalOnSiteDays = entries.filter((day) => day.onSite && Number.parseFloat(day.hours) > 0).length

  const updateEntry = (index: number, field: "hours" | "description" | "onSite", value: string | boolean) => {
    if (isLocked) return

    setEntries((prev) => {
      const updated = [...prev]
      updated[index] = {
        ...updated[index],
        [field]: value,
        isDirty: true,
      }
      return updated
    })
    setSavedMessage("")
  }

  const handleSave = async () => {
    if (isLocked) return

    setIsSaving(true)
    const supabase = createClient()

    try {
      const dirtyEntries = entries.filter((day) => day.isDirty)

      for (const day of dirtyEntries) {
        const dateStr = `${timesheet.year}-${String(timesheet.month).padStart(2, "0")}-${String(day.dayOfMonth).padStart(2, "0")}`
        const hours = Number.parseFloat(day.hours) || 0

        if (day.entry) {
          if (hours === 0 && !day.description) {
            await supabase.from("time_entries").delete().eq("id", day.entry.id)
          } else {
            await supabase
              .from("time_entries")
              .update({
                hours,
                description: day.description || null,
                on_site: day.onSite,
                updated_at: new Date().toISOString(),
              })
              .eq("id", day.entry.id)
          }
        } else if (hours > 0 || day.description) {
          await supabase.from("time_entries").insert({
            user_id: userId,
            timesheet_id: timesheet.id,
            entry_date: dateStr,
            hours,
            description: day.description || null,
            on_site: day.onSite,
          })
        }
      }

      setEntries((prev) => prev.map((day) => ({ ...day, isDirty: false })))
      setSavedMessage("Changes saved!")
      router.refresh()
    } catch (error) {
      console.error("Error saving entries:", error)
      setSavedMessage("Error saving changes")
    } finally {
      setIsSaving(false)
    }
  }

  const handleStatusToggle = async () => {
    setIsUpdatingStatus(true)
    const supabase = createClient()
    const newStatus: TimesheetStatus = status === "in_progress" ? "completed" : "in_progress"

    try {
      const { error } = await supabase
        .from("timesheets")
        .update({
          status: newStatus,
          updated_at: new Date().toISOString(),
        })
        .eq("id", timesheet.id)

      if (error) throw error

      setStatus(newStatus)
      setSavedMessage(newStatus === "completed" ? "Timesheet marked as completed" : "Timesheet reopened for editing")
      router.refresh()
    } catch (error) {
      console.error("Error updating status:", error)
      setSavedMessage("Error updating status")
    } finally {
      setIsUpdatingStatus(false)
    }
  }

  const handleExportPDF = async () => {
    setIsExporting(true)
    try {
      const entriesForPDF: TimeEntry[] = entries
        .filter((day) => day.hours || day.description)
        .map((day) => ({
          id: day.entry?.id || "",
          user_id: userId,
          timesheet_id: timesheet.id,
          entry_date: `${timesheet.year}-${String(timesheet.month).padStart(2, "0")}-${String(day.dayOfMonth).padStart(2, "0")}`,
          hours: Number.parseFloat(day.hours) || 0,
          description: day.description || null,
          on_site: day.onSite,
          created_at: day.entry?.created_at || new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }))

      generateTimesheetPDF(customer, timesheet, entriesForPDF)
      setSavedMessage("PDF exported successfully!")
    } catch (error) {
      console.error("Error exporting PDF:", error)
      setSavedMessage("Error exporting PDF")
    } finally {
      setIsExporting(false)
    }
  }

  const hasDirtyEntries = entries.some((day) => day.isDirty)

  return (
    <main className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <Button variant="ghost" asChild className="mb-4">
          <Link href={`/dashboard/customers/${customer.id}/timesheets`}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Timesheets
          </Link>
        </Button>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold">
                {MONTHS[timesheet.month - 1]} {timesheet.year}
              </h1>
              {isLocked ? (
                <Badge variant="default" className="bg-green-600 hover:bg-green-700">
                  <CheckCircle2 className="mr-1 h-3 w-3" />
                  Completed
                </Badge>
              ) : (
                <Badge variant="secondary">
                  <Clock className="mr-1 h-3 w-3" />
                  In Progress
                </Badge>
              )}
            </div>
            <p className="text-muted-foreground">{customer.name}</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {savedMessage && (
              <span className={`text-sm ${savedMessage.includes("Error") ? "text-destructive" : "text-green-600"}`}>
                {savedMessage}
              </span>
            )}
            <Button variant="outline" onClick={handleExportPDF} disabled={isExporting}>
              <FileDown className="mr-2 h-4 w-4" />
              {isExporting ? "Exporting..." : "Export PDF"}
            </Button>
            <Button onClick={handleSave} disabled={isSaving || !hasDirtyEntries || isLocked}>
              <Save className="mr-2 h-4 w-4" />
              {isSaving ? "Saving..." : "Save Changes"}
            </Button>
            <Button
              variant={isLocked ? "outline" : "default"}
              onClick={handleStatusToggle}
              disabled={isUpdatingStatus || hasDirtyEntries}
              className={isLocked ? "" : "bg-green-600 hover:bg-green-700"}
            >
              {isLocked ? (
                <>
                  <Unlock className="mr-2 h-4 w-4" />
                  {isUpdatingStatus ? "Reopening..." : "Reopen for Editing"}
                </>
              ) : (
                <>
                  <Lock className="mr-2 h-4 w-4" />
                  {isUpdatingStatus ? "Completing..." : "Mark as Completed"}
                </>
              )}
            </Button>
          </div>
        </div>
      </div>

      {isLocked && (
        <Alert className="mb-6 border-green-200 bg-green-50 text-green-800">
          <Lock className="h-4 w-4" />
          <AlertDescription>
            This timesheet is marked as completed and is locked for editing. Click "Reopen for Editing" to make changes.
          </AlertDescription>
        </Alert>
      )}

      {hasDirtyEntries && !isLocked && (
        <Alert className="mb-6 border-amber-200 bg-amber-50 text-amber-800">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            You have unsaved changes. Please save before marking the timesheet as completed.
          </AlertDescription>
        </Alert>
      )}

      <Card className="mb-6">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-6">
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-muted-foreground" />
              <span className="text-2xl font-bold">{totalHours.toFixed(1)} h</span>
              <span className="text-muted-foreground">total</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">On-site days:</span>
              <span className="font-semibold">{totalOnSiteDays}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className={isLocked ? "opacity-75" : ""}>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-24">Date</TableHead>
                  <TableHead className="w-12">Day</TableHead>
                  <TableHead className="min-w-[300px]">Activity</TableHead>
                  <TableHead className="w-20 text-center">On-site</TableHead>
                  <TableHead className="w-24 text-right">Hours</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.map((day, index) => (
                  <TableRow key={day.dayOfMonth} className={day.isWeekend ? "bg-muted/50" : ""}>
                    <TableCell className="font-medium">
                      {day.dayOfMonth}. {timesheet.month}.
                    </TableCell>
                    <TableCell className={day.isWeekend ? "text-muted-foreground" : ""}>{day.dayOfWeek}</TableCell>
                    <TableCell>
                      <Textarea
                        value={day.description}
                        onChange={(e) => updateEntry(index, "description", e.target.value)}
                        placeholder={isLocked ? "" : "Activity description..."}
                        className="min-h-[38px] resize-none"
                        rows={1}
                        disabled={isLocked}
                      />
                    </TableCell>
                    <TableCell className="text-center">
                      <Checkbox
                        checked={day.onSite}
                        onCheckedChange={(checked) => updateEntry(index, "onSite", checked as boolean)}
                        disabled={isLocked}
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        step="0.25"
                        min="0"
                        max="24"
                        value={day.hours}
                        onChange={(e) => updateEntry(index, "hours", e.target.value)}
                        placeholder={isLocked ? "" : "0"}
                        className="text-right"
                        disabled={isLocked}
                      />
                    </TableCell>
                  </TableRow>
                ))}
                <TableRow className="bg-muted font-semibold">
                  <TableCell colSpan={3} className="text-right">
                    TOTAL
                  </TableCell>
                  <TableCell className="text-center">{totalOnSiteDays}</TableCell>
                  <TableCell className="text-right">{totalHours.toFixed(1)} h</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </main>
  )
}
