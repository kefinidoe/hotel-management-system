import { NextResponse } from "next/server";
import { requireAuth, requireRole, ROLE_GROUPS } from "@/lib/authz";
import { getRestaurantActivity } from "@/lib/restaurant-dashboard";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const forbidden = requireRole(auth, ROLE_GROUPS.RESTAURANT_POS);
  if (forbidden) return forbidden;

  return NextResponse.json(await getRestaurantActivity());
}
