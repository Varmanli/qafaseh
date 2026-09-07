"use client";

import RichTextEditor from "@/components/content/RichTextEditor";

export default function AdminRichTextEditor(props: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  stickyToolbar?: boolean;
}) {
  return <RichTextEditor {...props} variant="admin" enableBookEmbeds iconOnly />;
}
