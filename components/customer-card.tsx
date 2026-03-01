"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Button } from "@/components/ui/button"
import { Clock, FileSpreadsheet, MoreHorizontal, Pencil, Trash2 } from "lucide-react"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import Link from "next/link"
import type { CustomerWithStats } from "@/lib/types"

interface CustomerCardProps {
  customer: CustomerWithStats
  onEdit: (customer: CustomerWithStats) => void
  onDelete: (customer: CustomerWithStats) => void
}

export function CustomerCard({ customer, onEdit, onDelete }: CustomerCardProps) {
  const percentUsed =
    customer.booked_hours > 0 ? Math.min((customer.total_hours_used / customer.booked_hours) * 100, 100) : 0

  const isOverBudget = customer.total_hours_used > customer.booked_hours

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-lg font-semibold">{customer.name}</CardTitle>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <MoreHorizontal className="h-4 w-4" />
              <span className="sr-only">Open menu</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onEdit(customer)}>
              <Pencil className="mr-2 h-4 w-4" />
              Edit
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onDelete(customer)} className="text-destructive">
              <Trash2 className="mr-2 h-4 w-4" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Hours used</span>
            <span className={isOverBudget ? "font-medium text-destructive" : "font-medium"}>
              {customer.total_hours_used.toFixed(1)} / {customer.booked_hours} h
            </span>
          </div>
          <Progress value={percentUsed} className={isOverBudget ? "[&>div]:bg-destructive" : ""} />
        </div>

        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-1 text-muted-foreground">
            <Clock className="h-4 w-4" />
            <span>Remaining</span>
          </div>
          <span className={`font-medium ${customer.hours_remaining < 0 ? "text-destructive" : "text-green-600"}`}>
            {customer.hours_remaining.toFixed(1)} h
          </span>
        </div>

        <Button asChild variant="outline" className="w-full bg-transparent">
          <Link href={`/dashboard/customers/${customer.id}/timesheets`}>
            <FileSpreadsheet className="mr-2 h-4 w-4" />
            View Timesheets
          </Link>
        </Button>
      </CardContent>
    </Card>
  )
}
