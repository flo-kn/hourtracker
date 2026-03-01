"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { CustomerCard } from "@/components/customer-card"
import { CustomerDialog } from "@/components/customer-dialog"
import { DeleteDialog } from "@/components/delete-dialog"
import { Plus, Users, Clock, TrendingUp } from "lucide-react"
import type { CustomerWithStats } from "@/lib/types"
import { calculateTotalBookedHours, calculateTotalUsedHours, calculateTotalRemainingHours } from "@/lib/calculations"

interface DashboardContentProps {
  initialCustomers: CustomerWithStats[]
  userId: string
  currentYear: number
}

export function DashboardContent({ initialCustomers, userId, currentYear }: DashboardContentProps) {
  const router = useRouter()
  const [customers, setCustomers] = useState<CustomerWithStats[]>(initialCustomers)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerWithStats | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const totalBookedHours = calculateTotalBookedHours(customers)
  const totalUsedHours = calculateTotalUsedHours(customers)
  const totalRemainingHours = calculateTotalRemainingHours(customers)

  const handleSaveCustomer = async (name: string, bookedHours: number) => {
    setIsLoading(true)
    const supabase = createClient()

    try {
      if (selectedCustomer) {
        // Update existing customer
        const { error } = await supabase
          .from("customers")
          .update({ name, booked_hours: bookedHours, updated_at: new Date().toISOString() })
          .eq("id", selectedCustomer.id)

        if (error) throw error

        setCustomers(
          customers.map((c) =>
            c.id === selectedCustomer.id
              ? {
                  ...c,
                  name,
                  booked_hours: bookedHours,
                  hours_remaining: bookedHours - c.total_hours_used,
                }
              : c,
          ),
        )
      } else {
        // Create new customer
        const { data, error } = await supabase
          .from("customers")
          .insert({ user_id: userId, name, booked_hours: bookedHours })
          .select()
          .single()

        if (error) throw error

        setCustomers([...customers, { ...data, total_hours_used: 0, hours_remaining: bookedHours }])
      }

      setIsDialogOpen(false)
      setSelectedCustomer(null)
      router.refresh()
    } catch (error) {
      console.error("Error saving customer:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleDeleteCustomer = async () => {
    if (!selectedCustomer) return
    setIsLoading(true)
    const supabase = createClient()

    try {
      const { error } = await supabase.from("customers").delete().eq("id", selectedCustomer.id)

      if (error) throw error

      setCustomers(customers.filter((c) => c.id !== selectedCustomer.id))
      setIsDeleteDialogOpen(false)
      setSelectedCustomer(null)
      router.refresh()
    } catch (error) {
      console.error("Error deleting customer:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleEditClick = (customer: CustomerWithStats) => {
    setSelectedCustomer(customer)
    setIsDialogOpen(true)
  }

  const handleDeleteClick = (customer: CustomerWithStats) => {
    setSelectedCustomer(customer)
    setIsDeleteDialogOpen(true)
  }

  return (
    <main className="container mx-auto px-4 py-8">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground">Overview for {currentYear}</p>
        </div>
        <Button
          onClick={() => {
            setSelectedCustomer(null)
            setIsDialogOpen(true)
          }}
        >
          <Plus className="mr-2 h-4 w-4" />
          Add Customer
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="mb-8 grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Customers</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{customers.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Hours Used ({currentYear})</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalUsedHours.toFixed(1)} h</div>
            <p className="text-xs text-muted-foreground">of {totalBookedHours} h booked</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Hours Remaining</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${totalRemainingHours < 0 ? "text-destructive" : "text-green-600"}`}>
              {totalRemainingHours.toFixed(1)} h
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Customer Cards */}
      {customers.length === 0 ? (
        <Card className="py-12">
          <CardContent className="flex flex-col items-center justify-center text-center">
            <Users className="mb-4 h-12 w-12 text-muted-foreground" />
            <h3 className="mb-2 text-lg font-semibold">No customers yet</h3>
            <p className="mb-4 text-sm text-muted-foreground">Add your first customer to start tracking hours</p>
            <Button
              onClick={() => {
                setSelectedCustomer(null)
                setIsDialogOpen(true)
              }}
            >
              <Plus className="mr-2 h-4 w-4" />
              Add Customer
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {customers.map((customer) => (
            <CustomerCard key={customer.id} customer={customer} onEdit={handleEditClick} onDelete={handleDeleteClick} />
          ))}
        </div>
      )}

      <CustomerDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        onSave={handleSaveCustomer}
        customer={selectedCustomer}
        isLoading={isLoading}
      />

      <DeleteDialog
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
        onConfirm={handleDeleteCustomer}
        title="Delete Customer"
        description={`Are you sure you want to delete "${selectedCustomer?.name}"? This will also delete all associated timesheets and time entries. This action cannot be undone.`}
        isLoading={isLoading}
      />
    </main>
  )
}
