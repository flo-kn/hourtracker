import { describe, it, expect } from "vitest"
import {
  calculateMonthlyHours,
  calculateTotalUsedHours,
  calculateTotalBookedHours,
  calculateTotalRemainingHours,
  calculateHoursRemaining,
} from "./calculations"
import type { CustomerWithStats } from "./types"

function makeCustomer(overrides: Partial<CustomerWithStats> = {}): CustomerWithStats {
  return {
    id: "c1",
    user_id: "u1",
    name: "Test Customer",
    booked_hours: 100,
    total_hours_used: 0,
    hours_remaining: 100,
    created_at: "2026-01-01",
    updated_at: "2026-01-01",
    ...overrides,
  }
}

describe("calculateMonthlyHours", () => {
  it("sums hours from numeric entries", () => {
    const entries = [{ hours: 8 }, { hours: 4 }, { hours: 2.5 }]
    expect(calculateMonthlyHours(entries)).toBe(14.5)
  })

  it("sums hours from string entries (as in UI state)", () => {
    const entries = [{ hours: "8" }, { hours: "4.5" }, { hours: "2" }]
    expect(calculateMonthlyHours(entries)).toBe(14.5)
  })

  it("treats empty strings as 0", () => {
    const entries = [{ hours: "8" }, { hours: "" }, { hours: "4" }]
    expect(calculateMonthlyHours(entries)).toBe(12)
  })

  it("treats non-numeric strings as 0", () => {
    const entries = [{ hours: "abc" }, { hours: "8" }]
    expect(calculateMonthlyHours(entries)).toBe(8)
  })

  it("returns 0 for empty array", () => {
    expect(calculateMonthlyHours([])).toBe(0)
  })

  it("handles a full month of daily 8h entries (e.g. 22 working days)", () => {
    const entries = Array.from({ length: 22 }, () => ({ hours: 8 }))
    expect(calculateMonthlyHours(entries)).toBe(176)
  })

  it("handles quarter-hour increments correctly", () => {
    const entries = [{ hours: 0.25 }, { hours: 0.5 }, { hours: 0.75 }, { hours: 1 }]
    expect(calculateMonthlyHours(entries)).toBe(2.5)
  })

  it("preserves decimal precision with many small values", () => {
    const entries = Array.from({ length: 10 }, () => ({ hours: 0.1 }))
    expect(calculateMonthlyHours(entries)).toBeCloseTo(1.0, 10)
  })

  it("handles mixed numeric and string entries", () => {
    const entries = [{ hours: 4 }, { hours: "3.5" }, { hours: 0 }, { hours: "" }]
    expect(calculateMonthlyHours(entries)).toBe(7.5)
  })

  describe("realistic monthly scenarios", () => {
    it("January 2026 - typical freelancer month", () => {
      const entries = [
        { hours: 8 },
        { hours: 7.5 },
        { hours: 8 },
        { hours: 8 },
        { hours: 6 },
        { hours: 8 },
        { hours: 8 },
        { hours: 4 },
        { hours: 8 },
        { hours: 8.5 },
      ]
      expect(calculateMonthlyHours(entries)).toBe(74)
    })

    it("month with only half-day entries", () => {
      const entries = Array.from({ length: 20 }, () => ({ hours: 4 }))
      expect(calculateMonthlyHours(entries)).toBe(80)
    })

    it("the 65.5h scenario (the original PDF bug value)", () => {
      const entries = [
        { hours: 8 },
        { hours: 8 },
        { hours: 8 },
        { hours: 8 },
        { hours: 8 },
        { hours: 8 },
        { hours: 8 },
        { hours: 8 },
        { hours: 1.5 },
      ]
      expect(calculateMonthlyHours(entries)).toBe(65.5)
    })
  })
})

describe("calculateTotalUsedHours", () => {
  it("sums used hours across multiple customers", () => {
    const customers = [
      makeCustomer({ total_hours_used: 40 }),
      makeCustomer({ id: "c2", total_hours_used: 65.5 }),
      makeCustomer({ id: "c3", total_hours_used: 20 }),
    ]
    expect(calculateTotalUsedHours(customers)).toBe(125.5)
  })

  it("returns 0 when no customers", () => {
    expect(calculateTotalUsedHours([])).toBe(0)
  })

  it("returns 0 when all customers have 0 hours used", () => {
    const customers = [
      makeCustomer({ total_hours_used: 0 }),
      makeCustomer({ id: "c2", total_hours_used: 0 }),
    ]
    expect(calculateTotalUsedHours(customers)).toBe(0)
  })

  it("handles single customer", () => {
    const customers = [makeCustomer({ total_hours_used: 42.75 })]
    expect(calculateTotalUsedHours(customers)).toBe(42.75)
  })
})

describe("calculateTotalBookedHours", () => {
  it("sums booked hours across multiple customers", () => {
    const customers = [
      makeCustomer({ booked_hours: 100 }),
      makeCustomer({ id: "c2", booked_hours: 200 }),
      makeCustomer({ id: "c3", booked_hours: 50 }),
    ]
    expect(calculateTotalBookedHours(customers)).toBe(350)
  })

  it("returns 0 when no customers", () => {
    expect(calculateTotalBookedHours([])).toBe(0)
  })

  it("handles string-coercible booked_hours (DB returns may vary)", () => {
    const customers = [
      makeCustomer({ booked_hours: "100" as unknown as number }),
      makeCustomer({ id: "c2", booked_hours: "200" as unknown as number }),
    ]
    expect(calculateTotalBookedHours(customers)).toBe(300)
  })
})

describe("calculateTotalRemainingHours", () => {
  it("sums remaining hours across customers", () => {
    const customers = [
      makeCustomer({ hours_remaining: 60 }),
      makeCustomer({ id: "c2", hours_remaining: 30.5 }),
    ]
    expect(calculateTotalRemainingHours(customers)).toBe(90.5)
  })

  it("handles negative remaining (over-budget customers)", () => {
    const customers = [
      makeCustomer({ hours_remaining: 20 }),
      makeCustomer({ id: "c2", hours_remaining: -10 }),
    ]
    expect(calculateTotalRemainingHours(customers)).toBe(10)
  })

  it("returns 0 when no customers", () => {
    expect(calculateTotalRemainingHours([])).toBe(0)
  })
})

describe("calculateHoursRemaining", () => {
  it("calculates remaining hours correctly", () => {
    expect(calculateHoursRemaining(100, 40)).toBe(60)
  })

  it("returns 0 when fully used", () => {
    expect(calculateHoursRemaining(100, 100)).toBe(0)
  })

  it("returns negative when over budget", () => {
    expect(calculateHoursRemaining(100, 120)).toBe(-20)
  })

  it("preserves decimal precision", () => {
    expect(calculateHoursRemaining(100, 65.5)).toBe(34.5)
  })

  it("handles 0 booked hours", () => {
    expect(calculateHoursRemaining(0, 10)).toBe(-10)
  })
})

describe("cross-function consistency", () => {
  it("totalUsed + totalRemaining = totalBooked", () => {
    const customers = [
      makeCustomer({ booked_hours: 100, total_hours_used: 40, hours_remaining: 60 }),
      makeCustomer({ id: "c2", booked_hours: 200, total_hours_used: 150, hours_remaining: 50 }),
      makeCustomer({ id: "c3", booked_hours: 50, total_hours_used: 55, hours_remaining: -5 }),
    ]

    const totalBooked = calculateTotalBookedHours(customers)
    const totalUsed = calculateTotalUsedHours(customers)
    const totalRemaining = calculateTotalRemainingHours(customers)

    expect(totalUsed + totalRemaining).toBe(totalBooked)
  })

  it("remaining matches booked - used for each customer", () => {
    const testCases = [
      { booked: 100, used: 40 },
      { booked: 200, used: 200 },
      { booked: 50, used: 80 },
      { booked: 0, used: 0 },
      { booked: 100, used: 65.5 },
    ]

    for (const { booked, used } of testCases) {
      expect(calculateHoursRemaining(booked, used)).toBe(booked - used)
    }
  })
})
