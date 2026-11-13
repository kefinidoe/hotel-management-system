import { NextResponse } from "next/server";
import { requireAuth, requireRole, ROLE_GROUPS } from "@/lib/authz";
import { ReportRangeError } from "@/lib/reporting";
import { fetchReportData } from "@/lib/reporting-logic";

export async function GET(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const forbidden = requireRole(auth, ROLE_GROUPS.FINANCIAL_REPORTS);
  if (forbidden) return forbidden;

  const { searchParams } = new URL(req.url);
  try {
    const data = await fetchReportData(searchParams.get("start"), searchParams.get("end"));
    return NextResponse.json(data);
  } catch (error) {
    if (error instanceof ReportRangeError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ error: "The report date range is invalid." }, { status: 400 });
  }
}
