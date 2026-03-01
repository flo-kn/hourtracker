"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { Customer } from "@/lib/types"

interface CustomerDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSave: (name: string, bookedHours: number) => Promise<void>
  customer?: Customer | null
  isLoading?: boolean
}

export function CustomerDialog({ open, onOpenChange, onSave, customer, isLoading }: CustomerDialogProps) {
  const [name, setName] = useState("")
  const [bookedHours, setBookedHours] = useState("")

  useEffect(() => {
    if (customer) {
      setName(customer.name)
      setBookedHours(customer.booked_hours.toString())
    } else {
      setName("")
      setBookedHours("")
    }
  }, [customer, open])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    await onSave(name, Number.parseFloat(bookedHours) || 0)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{customer ? "Edit Customer" : "Add New Customer"}</DialogTitle>
          <DialogDescription>
            {customer ? "Update customer details" : "Create a new customer with a booked hours budget"}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Customer Name</Label>
              <Input
                id="name"
                placeholder="e.g., Acme Corp"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="hours">Booked Hours</Label>
              <Input
                id="hours"
                type="number"
                step="0.5"
                min="0"
                placeholder="e.g., 100"
                value={bookedHours}
                onChange={(e) => setBookedHours(e.target.value)}
                required
              />
              <p className="text-xs text-muted-foreground">Total hours the customer has booked/paid for</p>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? "Saving..." : customer ? "Save Changes" : "Add Customer"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
