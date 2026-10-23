import { parseImportExcel } from "@/lib/books/import/parse-excel";
import { parseImportJson } from "@/lib/books/import/parse-json";
import type { NormalizedImportBook } from "@/lib/books/import/types";

function getFileExtension(filename: string): string {
  const lastDot = filename.lastIndexOf(".");
  return lastDot >= 0 ? filename.slice(lastDot + 1).toLowerCase() : "";
}

export async function parseImportFile(file: File): Promise<NormalizedImportBook[]> {
  if (!(file instanceof File) || file.size === 0 || file.size > 10 * 1024 * 1024) {
    throw new Error("IMPORT_FILE_TOO_LARGE");
  }
  const extension = getFileExtension(file.name);

  if (extension === "json" || file.type.includes("json")) {
    return parseImportJson(await file.text());
  }

  if (
    extension === "xlsx" ||
    extension === "xls" ||
    file.type.includes("sheet") ||
    file.type.includes("excel")
  ) {
    return parseImportExcel(await file.arrayBuffer());
  }

  throw new Error("UNSUPPORTED_IMPORT_FILE");
}
