import { NextRequest } from "next/server";
import { apiError, apiSuccess } from "@/lib/api/response";
import { getCurrentUser } from "@/lib/auth/session";
import { getPublicProfile } from "@/lib/profile/service";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ username: string }> }
) {
  const { username } = await params;
  const viewer = await getCurrentUser();

  const result = await getPublicProfile(username, viewer?.id);

  if (!result.found) {
    return apiError("کاربر یافت نشد", 404, "USER_NOT_FOUND");
  }

  if (result.isPrivate) {
    const { userId: _userId, ...publicResult } = result;
    return apiSuccess({ result: publicResult });
  }
  const { userId: _userId, ...profile } = result.profile;
  return apiSuccess({ result: { ...result, profile } });
}
