import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default function IranKetabDiscoveryDashboardPage() {
  redirect("/admin/iranketab-discovery/sources");
}
