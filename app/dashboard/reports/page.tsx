import ReportsClient from "@/components/reports/ReportsClient";
import { requirePageRole } from "@/lib/page-auth";
import { ROLE_GROUPS } from "@/lib/permissions";
import { fetchReportData } from "@/lib/reporting-logic";

export const dynamic = "force-dynamic";

export default async function ReportsPage() {
  await requirePageRole(ROLE_GROUPS.FINANCIAL_REPORTS);
  const initialData = await fetchReportData();
  return <ReportsClient initialData={initialData} />;
}
