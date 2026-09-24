import { ListOrdered } from "lucide-react";

import HomeSectionHeader from "@/components/home/HomeSectionHeader";
import ReadingListCard from "@/components/lists/ReadingListCard";
import type { ReadingListPreview } from "@/lib/book/reading-lists-service";

export default function HomeReadingListsPreview({
  lists,
}: {
  lists: ReadingListPreview[];
}) {
  if (!lists.length) return null;

  return (
    <section dir="rtl">
      <HomeSectionHeader
        icon={ListOrdered}
        title="مسیرهای مطالعه"
        href="/lists"
        linkLabel="دیدن همه مسیرها"
      />

      <div className="grid gap-4 lg:grid-cols-2 lg:gap-5">
        {lists.map((list) => (
          <ReadingListCard key={list.id} list={list} />
        ))}
      </div>
    </section>
  );
}
