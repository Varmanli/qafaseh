"use client";

import { useEffect, useState } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import { DOMParser as ProseMirrorDOMParser } from "@tiptap/pm/model";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import StarterKit from "@tiptap/starter-kit";
import {
  Bold,
  BookOpen,
  Heading2,
  Heading3,
  Italic,
  Link2,
  List,
  ListOrdered,
  Quote,
  Redo2,
  RemoveFormatting,
  Undo2,
} from "lucide-react";

import { BlogBookEmbedNode } from "@/components/blog/editor/BlogBookEmbedNode";
import { BlogBookPicker, type BlogBookPickerResult } from "@/components/blog/editor/BlogBookPicker";
import { cn } from "@/lib/utils";
import { looksLikeMarkdown, markdownToRichTextHtml } from "@/lib/content/markdown";

type EditorVariant = "admin" | "note";

export default function RichTextEditor({
  value,
  onChange,
  placeholder,
  className,
  variant = "admin",
  ariaLabel,
  enableBookEmbeds = false,
  stickyToolbar = false,
  iconOnly = false,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  variant?: EditorVariant;
  ariaLabel?: string;
  enableBookEmbeds?: boolean;
  stickyToolbar?: boolean;
  iconOnly?: boolean;
}) {
  const isNote = variant === "note";
  const [bookPickerOpen, setBookPickerOpen] = useState(false);
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({ heading: isNote ? false : { levels: [2, 3] } }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: { rel: "noreferrer noopener", target: "_blank" },
      }),
      Placeholder.configure({
        placeholder: placeholder ?? "توضیحات کتاب را اینجا بنویس...",
      }),
      ...(!isNote && enableBookEmbeds ? [BlogBookEmbedNode] : []),
    ],
    content: value,
    editorProps: {
      handlePaste: (view, event) => {
        const text = event.clipboardData?.getData("text/plain") ?? "";
        if (!looksLikeMarkdown(text)) return false;

        const container = document.createElement("div");
        container.innerHTML = markdownToRichTextHtml(text);
        const slice = ProseMirrorDOMParser.fromSchema(view.state.schema).parseSlice(container);
        view.dispatch(view.state.tr.replaceSelection(slice).scrollIntoView());
        return true;
      },
      attributes: {
        dir: "rtl",
        role: "textbox",
        "aria-label": ariaLabel ?? "ویرایشگر متن",
        class: cn(
          "magazine-rich-text ProseMirror w-full break-words text-right text-sm leading-8 text-foreground outline-none",
          "[overflow-wrap:anywhere] [&_a]:break-all [&_a]:text-primary [&_a]:underline",
          "[&_ol]:list-decimal [&_ol]:pr-7 [&_ol]:pl-2 [&_ul]:list-disc [&_ul]:pr-7 [&_ul]:pl-2",
          "[&_p.is-editor-empty:first-child::before]:pointer-events-none [&_p.is-editor-empty:first-child::before]:float-right [&_p.is-editor-empty:first-child::before]:h-0 [&_p.is-editor-empty:first-child::before]:text-muted-foreground/70 [&_p.is-editor-empty:first-child::before]:content-[attr(data-placeholder)]",
          isNote ? "min-h-64 px-4 py-4 sm:min-h-96 sm:px-5" : "min-h-64 px-5 py-4 [&_h2]:text-xl [&_h2]:font-black [&_h3]:text-lg [&_h3]:font-black",
        ),
      },
    },
    onUpdate: ({ editor: currentEditor }) => onChange(currentEditor.getHTML()),
  });

  useEffect(() => {
    if (editor && editor.getHTML() !== value) {
      editor.commands.setContent(value, { emitUpdate: false });
    }
  }, [editor, value]);

  if (!editor) return <div className="min-h-56 animate-pulse bg-muted/20" />;

  const setLink = () => {
    const previousUrl = editor.getAttributes("link").href as string | undefined;
    const url = window.prompt("لینک را وارد کن", previousUrl ?? "https://");
    if (url === null) return;
    if (!url.trim()) {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
  };

  const insertBookEmbed = (book: BlogBookPickerResult) => {
    editor
      .chain()
      .focus()
      .insertContent({ type: "blogBookEmbed", attrs: { bookId: book.id } })
      .run();
  };

  return (
    <div
      dir="rtl"
      className={cn(
        "flex min-h-0 flex-col rounded-[1.35rem] border border-border/75 bg-background/70 shadow-inner transition focus-within:border-primary/35 focus-within:ring-2 focus-within:ring-primary/15",
        stickyToolbar ? "overflow-visible" : "overflow-hidden",
        className,
      )}
    >
      <div className={cn(
        "flex shrink-0 items-center gap-1.5 overflow-x-auto border-b border-border/70 bg-card/90 p-2 sm:flex-wrap sm:gap-2 sm:p-3",
        stickyToolbar && "sticky top-14 z-30",
        iconOnly && "[&>button>span:last-child]:hidden [&>button]:px-2.5",
      )}>
        <ToolbarButton active={editor.isActive("bold")} onClick={() => editor.chain().focus().toggleBold().run()} icon={<Bold />} label="ضخیم" compact={isNote} />
        <ToolbarButton active={editor.isActive("italic")} onClick={() => editor.chain().focus().toggleItalic().run()} icon={<Italic />} label="مورب" compact={isNote} />
        {!isNote ? <ToolbarButton active={editor.isActive("heading", { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} icon={<Heading2 />} label="تیتر ۲" /> : null}
        {!isNote ? <ToolbarButton active={editor.isActive("heading", { level: 3 })} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} icon={<Heading3 />} label="تیتر ۳" /> : null}
        <ToolbarButton active={editor.isActive("bulletList")} onClick={() => editor.chain().focus().toggleBulletList().run()} icon={<List />} label="فهرست" compact={isNote} />
        <ToolbarButton active={editor.isActive("orderedList")} onClick={() => editor.chain().focus().toggleOrderedList().run()} icon={<ListOrdered />} label="شماره‌دار" compact={isNote} />
        <ToolbarButton active={editor.isActive("blockquote")} onClick={() => editor.chain().focus().toggleBlockquote().run()} icon={<Quote />} label="نقل‌قول" compact={isNote} />
        <ToolbarButton active={editor.isActive("link")} onClick={setLink} icon={<Link2 />} label="لینک" compact={isNote} />
        {!isNote && enableBookEmbeds ? <ToolbarButton onClick={() => setBookPickerOpen(true)} icon={<BookOpen />} label="افزودن کتاب" /> : null}
        <ToolbarButton onClick={() => editor.chain().focus().unsetAllMarks().clearNodes().run()} icon={<RemoveFormatting />} label="پاک‌سازی" compact={isNote} />
        <span aria-hidden className="mx-0.5 h-6 w-px shrink-0 bg-border/80" />
        <ToolbarButton onClick={() => editor.chain().focus().undo().run()} disabled={!editor.can().chain().focus().undo().run()} icon={<Undo2 />} label="واگرد" compact={isNote} />
        <ToolbarButton onClick={() => editor.chain().focus().redo().run()} disabled={!editor.can().chain().focus().redo().run()} icon={<Redo2 />} label="ازنو" compact={isNote} />
      </div>
      <EditorContent editor={editor} className={cn("min-h-0 bg-transparent", isNote && "overflow-y-auto overscroll-contain")} />
      {!isNote && enableBookEmbeds ? <BlogBookPicker open={bookPickerOpen} onOpenChange={setBookPickerOpen} onPick={insertBookEmbed} /> : null}
    </div>
  );
}

function ToolbarButton({ active = false, disabled = false, onClick, icon, label, compact = false }: { active?: boolean; disabled?: boolean; onClick: () => void; icon: React.ReactNode; label: string; compact?: boolean }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} title={label} aria-label={label} aria-pressed={active} className={cn("inline-flex h-9 shrink-0 items-center justify-center gap-2 rounded-xl border px-2.5 text-xs font-bold transition sm:px-3", active ? "border-primary/30 bg-primary/12 text-primary" : "border-border/70 bg-background/70 text-foreground hover:border-primary/25 hover:text-primary", disabled && "cursor-not-allowed opacity-40")}>
      <span className="[&_svg]:h-4 [&_svg]:w-4">{icon}</span>
      <span className={cn(compact && "hidden lg:inline")}>{label}</span>
    </button>
  );
}
