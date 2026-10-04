"use client";

import { useEffect, useState } from "react";

export type ContentChanges = {
  content: string;
  imageKey?: string | null;
  page?: number | null;
  background?: string;
};
const CONTENT_EDITED = "ghafaseh:content-edited";
type ContentEdit = { type: "QUOTE" | "NOTE"; id: string; changes: ContentChanges };

export function notifyContentEdited(type: ContentEdit["type"], id: string, changes: ContentChanges) {
  window.dispatchEvent(new CustomEvent<ContentEdit>(CONTENT_EDITED, { detail: { type, id, changes } }));
}

// A content item can appear in both its own section and the activity list.
export function useEditedContent<T extends { id: string; content: string }>(type: ContentEdit["type"], initial: T): T;
export function useEditedContent<T extends { id: string; content: string }>(type: ContentEdit["type"], initial: T | null): T | null;
export function useEditedContent<T extends { id: string; content: string }>(type: ContentEdit["type"], initial: T | null): T | null {
  const [edit, setEdit] = useState<ContentEdit | null>(null);
  useEffect(() => {
    function sync(event: Event) {
      const edit = (event as CustomEvent<ContentEdit>).detail;
      if (edit.type === type && edit.id === initial?.id) setEdit(edit);
    }
    window.addEventListener(CONTENT_EDITED, sync);
    return () => window.removeEventListener(CONTENT_EDITED, sync);
  }, [type, initial?.id]);
  return initial && edit?.id === initial.id ? { ...initial, ...edit.changes } : initial;
}
