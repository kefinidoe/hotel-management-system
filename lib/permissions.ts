import type { RoleName } from "@prisma/client";

// Pure permission data shared by server routes and client navigation.
// Keep this file free of database/auth imports so it is safe in client code.
export const ROLE_GROUPS = {
  ALL_STAFF: [
    "ADMIN",
    "MANAGER",
    "RECEPTIONIST",
    "HOUSEKEEPER",
    "WAITER",
    "CASHIER",
    "ACCOUNTANT",
    "TECHNICIAN",
  ],
  MANAGEMENT: ["ADMIN", "MANAGER"],
  GUEST_STAYS: ["ADMIN", "MANAGER", "RECEPTIONIST"],
  FRONT_DESK: ["ADMIN", "MANAGER", "RECEPTIONIST", "CASHIER"],
  ACCOMMODATION_PAYMENTS: ["ADMIN", "MANAGER", "RECEPTIONIST", "CASHIER"],
  PAYMENT_OPERATIONS: ["ADMIN", "MANAGER", "RECEPTIONIST", "WAITER", "CASHIER"],
  RESTAURANT_POS: ["ADMIN", "MANAGER", "WAITER", "CASHIER"],
  HOUSEKEEPING: ["ADMIN", "MANAGER", "HOUSEKEEPER"],
  MAINTENANCE: ["ADMIN", "MANAGER", "TECHNICIAN"],
  FINANCIAL_REPORTS: ["ADMIN", "MANAGER", "ACCOUNTANT"],
  STAFF_VIEW: ["ADMIN", "MANAGER"],
  STAFF_ADMIN: ["ADMIN"],
} satisfies Record<string, RoleName[]>;

export function hasRole(role: RoleName, allowed: readonly RoleName[]): boolean {
  return allowed.includes(role);
}
