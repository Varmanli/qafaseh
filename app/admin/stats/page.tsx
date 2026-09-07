import AdminAnalyticsDashboard from "@/components/admin/AdminAnalyticsDashboard";
import { getAdminAnalytics, parseAnalyticsPeriod } from "@/lib/admin/analytics";

export const dynamic = "force-dynamic";

export default async function AdminStatsPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  const period = parseAnalyticsPeriod((await searchParams).period);
  const analytics = await getAdminAnalytics(period);

  return <AdminAnalyticsDashboard analytics={analytics} />;
}
