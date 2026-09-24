import Link from "next/link";
import { Users } from "lucide-react";

import AuthorAvatar from "@/components/reference/AuthorAvatar";
import HomeSectionHeader from "@/components/home/HomeSectionHeader";
import { Carousel } from "@/components/ui/Carousel";

interface PopularAuthor {
  id: string;
  name: string;
  slug: string | null;
  coverImage: string | null;
  bookCount: number;
  readCount: number;
}

function AuthorCard({ author }: { author: PopularAuthor }) {
  const href = `/authors/${encodeURIComponent(author.slug ?? author.name)}`;

  return (
    <Link
      href={href}
      className="group flex flex-col items-center gap-3 rounded-2xl p-2 text-center transition-transform duration-300 hover:-translate-y-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
    >
      <div className="relative">
        <div className="pointer-events-none absolute -inset-3 rounded-full bg-primary/15 opacity-0 blur-xl transition-opacity duration-300 group-hover:opacity-100" />
        <AuthorAvatar
          name={author.name}
          image={author.coverImage}
          sizeClassName="h-24 w-24 transition-shadow duration-300 group-hover:ring-2 group-hover:ring-primary/40 sm:h-28 sm:w-28"
        />
      </div>

      <h3 className="line-clamp-1 max-w-full font-black text-sm text-foreground/90 transition-colors duration-200 group-hover:text-primary">
        {author.name}
      </h3>
    </Link>
  );
}

export default function HomePopularAuthors({
  authors,
}: {
  authors: PopularAuthor[];
}) {
  if (!authors.length) return null;
  return (
    <section className="relative">
      <div className="mb-4 sm:mb-5">
        <HomeSectionHeader
          icon={Users}
          title="نویسنده های منتخب"
          href="/authors"
        />
      </div>

      <Carousel
        ariaLabel="نویسندگان محبوب"
        slideClassName="basis-[135px] py-4 sm:basis-[170px] lg:basis-[190px]"
        containerClassName="gap-4"
        slides={authors.map((author) => (
          <AuthorCard key={author.id} author={author} />
        ))}
      />
    </section>
  );
}
