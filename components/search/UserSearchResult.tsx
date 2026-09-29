import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type { PublicUserSearchResult } from "@/lib/search/user-search";

export default function UserSearchResult({ user }: { user: PublicUserSearchResult }) {
  const displayName = user.name?.trim() || user.username;
  return (
    <div className="flex min-w-0 items-center gap-3">
      <Avatar className="size-11 border border-border/40 sm:size-12">
        {user.image ? <AvatarImage src={user.image} alt={displayName} className="object-cover" /> : null}
        <AvatarFallback className="text-sm font-bold text-muted-foreground">
          {displayName.charAt(0)}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-black text-foreground sm:text-sm">{displayName}</p>
        <p dir="ltr" className="mt-0.5 truncate text-left text-[11px] text-muted-foreground">@{user.username}</p>
      </div>
    </div>
  );
}
