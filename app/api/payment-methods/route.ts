import { NextResponse } from "next/server";
import { requireAuth, requireRole, ROLE_GROUPS } from "@/lib/authz";
import { getRestaurantPaymentMethods } from "@/lib/restaurant-dashboard";

export async function GET() {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const forbidden = requireRole(auth, ROLE_GROUPS.PAYMENT_OPERATIONS);
  if (forbidden) return forbidden;

  return NextResponse.json(await getRestaurantPaymentMethods());
}
