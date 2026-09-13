import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default function IranKetabDiscoveryCandidatesPage() {
  redirect("/admin/iranketab-discovery/sources");
}
