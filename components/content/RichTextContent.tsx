import { sanitizeRichTextHtml } from "@/lib/content/rich-text";
import { cn } from "@/lib/utils";

export default function RichTextContent({
  content,
  className,
}: {
  content: string;
  className?: string;
}) {
  const html = sanitizeRichTextHtml(content);

  return (
    <div
      className={cn(
        "persian-prose",
        className ??
        "magazine-rich-text [&_a]:text-primary [&_a]:underline [&_ol]:list-decimal [&_ol]:pr-6 [&_ul]:list-disc [&_ul]:pr-6",
      )}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
