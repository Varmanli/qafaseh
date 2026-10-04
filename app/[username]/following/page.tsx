import FollowListPage from "@/components/profile/FollowListPage";

export const dynamic = "force-dynamic";

export default async function Page({ params, searchParams }: { params: Promise<{ username: string }>; searchParams: Promise<{ page?: string; q?: string }> }) {
  const { username } = await params;
  const { page: pageParam, q = "" } = await searchParams;
  const rawPage = Number(pageParam);
  const page = Number.isSafeInteger(rawPage) && rawPage > 0 ? rawPage : 1;
  return <FollowListPage username={username} kind="following" page={page} query={q.slice(0, 100)} />;
}
