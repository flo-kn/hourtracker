"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { DeleteDialog } from "@/components/delete-dialog"
import { ArrowLeft, Plus, FileSpreadsheet, Calendar, Clock, Trash2, CheckCircle2 } from "lucide-react"
import Link from "next/link"
import type { Customer, Timesheet } from "@/lib/types"

interface TimesheetWithHours extends Timesheet {
  total_hours: number
}

interface TimesheetsContentProps {
  customer: Customer
  initialTimesheets: TimesheetWithHours[]
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

export function TimesheetsContent({ customer, initialTimesheets, userId }: TimesheetsContentProps) {
  const router = useRouter()
  const [timesheets, setTimesheets] = useState<TimesheetWithHours[]>(initialTimesheets)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [selectedTimesheet, setSelectedTimesheet] = useState<TimesheetWithHours | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const currentDate = new Date()
  const [selectedMonth, setSelectedMonth] = useState((currentDate.getMonth() + 1).toString())
  const [selectedYear, setSelectedYear] = useState(currentDate.getFullYear().toString())

  const years = Array.from({ length: 5 }, (_, i) => currentDate.getFullYear() - 2 + i)

  const handleCreateTimesheet = async () => {
    setIsLoading(true)
    const supabase = createClient()

    try {
      const { data, error } = await supabase
        .from("timesheets")
        .insert({
          user_id: userId,
          customer_id: customer.id,
          month: Number.parseInt(selectedMonth),
          year: Number.parseInt(selectedYear),
          status: "in_progress",
        })
        .select()
        .single()

      if (error) {
        if (error.code === "23505") {
          alert("A timesheet for this month already exists")
        }
        throw error
      }

      setTimesheets([{ ...data, total_hours: 0 }, ...timesheets])
      setIsDialogOpen(false)
      router.refresh()
    } catch (error) {
      console.error("Error creating timesheet:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleDeleteTimesheet = async () => {
    if (!selectedTimesheet) return
    setIsLoading(true)
    const supabase = createClient()

    try {
      const { error } = await supabase.from("timesheets").delete().eq("id", selectedTimesheet.id)

      if (error) throw error

      setTimesheets(timesheets.filter((t) => t.id !== selectedTimesheet.id))
      setIsDeleteDialogOpen(false)
      setSelectedTimesheet(null)
      router.refresh()
    } catch (error) {
      console.error("Error deleting timesheet:", error)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <main className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <Button variant="ghost" asChild className="mb-4">
          <Link href="/dashboard">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Dashboard
          </Link>
        </Button>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold">{customer.name}</h1>
            <p className="text-muted-foreground">{customer.booked_hours} hours booked</p>
          </div>
          <Button onClick={() => setIsDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            New Timesheet
          </Button>
        </div>
      </div>

      {timesheets.length === 0 ? (
        <Card className="py-12">
          <CardContent className="flex flex-col items-center justify-center text-center">
            <FileSpreadsheet className="mb-4 h-12 w-12 text-muted-foreground" />
            <h3 className="mb-2 text-lg font-semibold">No timesheets yet</h3>
            <p className="mb-4 text-sm text-muted-foreground">Create a timesheet to start logging hours</p>
            <Button onClick={() => setIsDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              New Timesheet
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {timesheets.map((timesheet) => (
            <Card key={timesheet.id} className="group relative">
              <Link href={`/dashboard/customers/${customer.id}/timesheets/${timesheet.id}`}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-lg font-semibold">
                    {MONTHS[timesheet.month - 1]} {timesheet.year}
                  </CardTitle>
                  {timesheet.status === "completed" ? (
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
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2 text-2xl font-bold">
                    <Calendar className="h-5 w-5 text-muted-foreground" />
                    {timesheet.total_hours.toFixed(1)} h
                  </div>
                </CardContent>
              </Link>
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-2 top-12 h-8 w-8 opacity-0 transition-opacity group-hover:opacity-100"
                onClick={(e) => {
                  e.preventDefault()
                  setSelectedTimesheet(timesheet)
                  setIsDeleteDialogOpen(true)
                }}
              >
                <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
              </Button>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Timesheet</DialogTitle>
            <DialogDescription>Select a month and year for the new timesheet</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Month</Label>
              <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MONTHS.map((month, index) => (
                    <SelectItem key={index} value={(index + 1).toString()}>
                      {month}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Year</Label>
              <Select value={selectedYear} onValueChange={setSelectedYear}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {years.map((year) => (
                    <SelectItem key={year} value={year.toString()}>
                      {year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateTimesheet} disabled={isLoading}>
              {isLoading ? "Creating..." : "Create Timesheet"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <DeleteDialog
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
        onConfirm={handleDeleteTimesheet}
        title="Delete Timesheet"
        description={`Are you sure you want to delete the timesheet for ${selectedTimesheet ? MONTHS[selectedTimesheet.month - 1] : ""} ${selectedTimesheet?.year}? All time entries will be deleted. This action cannot be undone.`}
        isLoading={isLoading}
      />
    </main>
  )
}
