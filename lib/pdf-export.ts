import jsPDF from "jspdf"
import type { Customer, Timesheet, TimeEntry } from "./types"
import { calculateMonthlyHours } from "./calculations"

const MONTHS_DE = [
  "Januar",
  "Februar",
  "März",
  "April",
  "Mai",
  "Juni",
  "Juli",
  "August",
  "September",
  "Oktober",
  "November",
  "Dezember",
]

const WEEKDAYS_DE = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"]

/**
 * Format hours for display in PDF.
 * Shows whole numbers without decimals, shows decimals with German comma notation.
 * This avoids JavaScript's default .5 rounding up behavior.
 */
export function formatHoursForPDF(hours: number): string {
  if (Number.isInteger(hours)) {
    return hours.toString()
  }
  return hours.toFixed(2).replace(".", ",")
}

interface DayData {
  dayOfMonth: number
  dayOfWeek: string
  isWeekend: boolean
  hours: number
  description: string
  onSite: boolean
}

export function generateTimesheetPDF(customer: Customer, timesheet: Timesheet, entries: TimeEntry[]): void {
  // DIN A4 dimensions in mm: 210 x 297
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  })

  const pageWidth = 210
  const pageHeight = 297
  const margin = 15
  const contentWidth = pageWidth - margin * 2

  // Generate all days in the month with their data
  const year = timesheet.year
  const month = timesheet.month - 1
  const numDays = new Date(year, month + 1, 0).getDate()

  const days: DayData[] = []
  for (let day = 1; day <= numDays; day++) {
    const date = new Date(year, month, day)
    const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`
    const entry = entries.find((e) => e.entry_date === dateStr)

    days.push({
      dayOfMonth: day,
      dayOfWeek: WEEKDAYS_DE[date.getDay()],
      isWeekend: date.getDay() === 0 || date.getDay() === 6,
      hours: entry?.hours || 0,
      description: entry?.description || "",
      onSite: entry?.on_site || false,
    })
  }

  const totalHours = calculateMonthlyHours(days)
  const totalOnSiteDays = days.filter((day) => day.onSite && day.hours > 0).length

  let y = margin

  // Header section
  doc.setFillColor(200, 80, 50) // Orange-red header color similar to Excel
  doc.rect(margin, y, contentWidth, 12, "F")

  doc.setTextColor(255, 255, 255)
  doc.setFontSize(14)
  doc.setFont("helvetica", "bold")
  doc.text(`Timesheet ${customer.name}`, pageWidth / 2, y + 8, { align: "center" })

  y += 18

  // Month and Year info
  doc.setTextColor(0, 0, 0)
  doc.setFontSize(11)
  doc.setFont("helvetica", "normal")
  doc.text(`Monat: ${MONTHS_DE[timesheet.month - 1]}`, margin, y)
  doc.text(`Jahr: ${timesheet.year}`, margin + 50, y)

  y += 10

  // Table header
  const colWidths = {
    date: 25,
    day: 12,
    activity: 100,
    onSite: 20,
    hours: 23,
  }

  // Draw table header
  doc.setFillColor(240, 240, 240)
  doc.rect(margin, y, contentWidth, 8, "F")
  doc.setDrawColor(180, 180, 180)
  doc.rect(margin, y, contentWidth, 8, "S")

  doc.setFontSize(9)
  doc.setFont("helvetica", "bold")

  let x = margin + 2
  doc.text("Datum", x, y + 5.5)
  x += colWidths.date
  doc.text("Tag", x, y + 5.5)
  x += colWidths.day
  doc.text("Tätigkeit", x, y + 5.5)
  x += colWidths.activity
  doc.text("Vor-Ort", x, y + 5.5)
  x += colWidths.onSite
  doc.text("Std.", x, y + 5.5)

  y += 8

  // Table rows
  doc.setFont("helvetica", "normal")
  doc.setFontSize(8)

  const rowHeight = 6.5

  for (const day of days) {
    // Check if we need a new page
    if (y + rowHeight > pageHeight - margin - 20) {
      doc.addPage()
      y = margin

      // Repeat header on new page
      doc.setFillColor(240, 240, 240)
      doc.rect(margin, y, contentWidth, 8, "F")
      doc.rect(margin, y, contentWidth, 8, "S")

      doc.setFontSize(9)
      doc.setFont("helvetica", "bold")

      x = margin + 2
      doc.text("Datum", x, y + 5.5)
      x += colWidths.date
      doc.text("Tag", x, y + 5.5)
      x += colWidths.day
      doc.text("Tätigkeit", x, y + 5.5)
      x += colWidths.activity
      doc.text("Vor-Ort", x, y + 5.5)
      x += colWidths.onSite
      doc.text("Std.", x, y + 5.5)

      y += 8
      doc.setFont("helvetica", "normal")
      doc.setFontSize(8)
    }

    // Row background for weekends
    if (day.isWeekend) {
      doc.setFillColor(248, 248, 248)
      doc.rect(margin, y, contentWidth, rowHeight, "F")
    }

    // Row border
    doc.setDrawColor(220, 220, 220)
    doc.rect(margin, y, contentWidth, rowHeight, "S")

    // Draw cell borders
    x = margin
    doc.line(x + colWidths.date, y, x + colWidths.date, y + rowHeight)
    x += colWidths.date
    doc.line(x + colWidths.day, y, x + colWidths.day, y + rowHeight)
    x += colWidths.day
    doc.line(x + colWidths.activity, y, x + colWidths.activity, y + rowHeight)
    x += colWidths.activity
    doc.line(x + colWidths.onSite, y, x + colWidths.onSite, y + rowHeight)

    // Cell content
    doc.setTextColor(day.isWeekend ? 120 : 0, day.isWeekend ? 120 : 0, day.isWeekend ? 120 : 0)

    x = margin + 2
    doc.text(`${day.dayOfMonth}. ${timesheet.month}.`, x, y + 4.5)
    x += colWidths.date
    doc.text(day.dayOfWeek, x, y + 4.5)
    x += colWidths.day

    // Truncate activity if too long
    const maxActivityWidth = colWidths.activity - 4
    let activityText = day.description
    if (doc.getTextWidth(activityText) > maxActivityWidth) {
      while (doc.getTextWidth(activityText + "...") > maxActivityWidth && activityText.length > 0) {
        activityText = activityText.slice(0, -1)
      }
      activityText += "..."
    }
    doc.text(activityText, x, y + 4.5)

    x += colWidths.activity
    if (day.onSite) {
      doc.text("X", x + colWidths.onSite / 2 - 2, y + 4.5)
    }
    x += colWidths.onSite

    if (day.hours > 0) {
      doc.text(day.hours.toFixed(2).replace(".", ","), x + colWidths.hours - 4, y + 4.5, { align: "right" })
    }

    y += rowHeight
  }

  // Summary row
  y += 2
  doc.setFillColor(240, 240, 240)
  doc.rect(margin, y, contentWidth, 8, "F")
  doc.rect(margin, y, contentWidth, 8, "S")

  doc.setFont("helvetica", "bold")
  doc.setFontSize(9)
  doc.setTextColor(0, 0, 0)

  x = margin + colWidths.date + colWidths.day + colWidths.activity - 15
  doc.text("SUMME", x, y + 5.5, { align: "right" })
  x = margin + colWidths.date + colWidths.day + colWidths.activity + colWidths.onSite + colWidths.hours - 4
  doc.text(`${formatHoursForPDF(totalHours)} h`, x, y + 5.5, { align: "right" })

  y += 8
  doc.setFont("helvetica", "normal")
  doc.setFontSize(8)
  x = margin + colWidths.date + colWidths.day + colWidths.activity - 15
  doc.text("(Vor-Ort-Tage:", x, y + 5, { align: "right" })
  x = margin + colWidths.date + colWidths.day + colWidths.activity + colWidths.onSite + colWidths.hours - 4
  doc.text(`${totalOnSiteDays} )`, x, y + 5, { align: "right" })

  // Footer with generation date
  doc.setFontSize(7)
  doc.setTextColor(150, 150, 150)
  doc.text(`Erstellt am ${new Date().toLocaleDateString("de-DE")}`, pageWidth - margin, pageHeight - 10, {
    align: "right",
  })

  // Save the PDF
  const filename = `Timesheet_${customer.name.replace(/\s+/g, "_")}_${timesheet.year}_${String(timesheet.month).padStart(2, "0")}.pdf`
  doc.save(filename)
}
