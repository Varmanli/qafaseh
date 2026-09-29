import type { IranKetabExtractionEnvelope } from "@ghafaseh/iranketab-extractor";
import { normalizeIsbn } from "@/lib/books/import/isbn";
import { splitMultiValueText } from "@/lib/book/genres";
import { normalizeReferenceName } from "@/lib/reference/normalize";

export type MatchConfidence = "EXACT" | "HIGH" | "MEDIUM" | "LOW" | "NONE";
export type CatalogStatus = "NEW" | "EXACT_MATCH" | "POSSIBLE_MATCH" | "CONFLICT";
export type EditionStatus = "NEW" | "EXACT_MATCH" | "POSSIBLE_MATCH" | "CONFLICT" | "INSUFFICIENT_DATA";
export type EntityStatus = "EXACT_MATCH" | "STRONG_MATCH" | "POSSIBLE_MATCH" | "NEW" | "AMBIGUOUS" | "CONFLICT";
export type Readiness = "READY_FOR_REVIEW" | "REQUIRES_ENTITY_SELECTION" | "REQUIRES_CATALOG_SELECTION" | "BLOCKED_BY_CONFLICT" | "INSUFFICIENT_DATA";
export type FieldComparison = { field: string; extractedValue: string | number | string[] | null; existingValue: string | number | string[] | null; status: "SAME" | "MISSING_IN_SOURCE" | "MISSING_IN_DATABASE" | "DIFFERENT" | "NORMALIZED_EQUAL" | "INVALID_SOURCE_VALUE"; severity: "INFO" | "WARNING" | "CONFLICT"; recommendation: "KEEP_EXISTING" | "FILL_MISSING" | "REVIEW_DIFFERENCE" | "SAFE_TO_UPDATE" | "DO_NOT_OVERWRITE" };
export type AnalysisIssue = { id: string; severity: "CRITICAL" | "WARNING" | "INFO"; message: string; blocksImport: boolean; recommendation: "KEEP_EXISTING" | "FILL_MISSING" | "REVIEW_DIFFERENCE" | "SAFE_TO_UPDATE" | "DO_NOT_OVERWRITE"; target: "CATALOG" | "EDITION" | "ENTITY"; extractedIndex?: number };
export type Candidate = { id: string; title: string; authors: string; originalTitle: string | null; editionCount: number; confidence: MatchConfidence; reasons: string[]; comparisons: FieldComparison[]; adminHref: string; safeToReuse: boolean };
export type EditionAnalysis = { extractedIndex: number; sourceEditionCode: string; status: EditionStatus; confidence: MatchConfidence; existingEditionId: string | null; existingCatalogId: string | null; existingCatalogTitle: string | null; reasons: string[]; comparisons: FieldComparison[]; adminHref: string | null; belongsToSelectedCatalog: boolean | null };
export type EntityAnalysis = { type: "AUTHOR" | "TRANSLATOR" | "PUBLISHER" | "GENRE" | "COUNTRY"; extractedName: string; normalizedName: string; status: EntityStatus; confidence: MatchConfidence; candidate: { id: string; name: string; adminHref: string } | null; alternatives: Array<{ id: string; name: string; adminHref: string }>; requiresManualSelection: boolean };
export type IranKetabMatchAnalysis = { catalog: { status: CatalogStatus; selected: Candidate | null; candidates: Candidate[] }; editions: EditionAnalysis[]; entities: EntityAnalysis[]; conflicts: AnalysisIssue[]; warnings: AnalysisIssue[]; summary: { catalogStatus: CatalogStatus; totalExtractedEditions: number; newEditions: number; exactEditionMatches: number; possibleEditionMatches: number; conflictingEditions: number; exactEntityMatches: number; possibleEntityMatches: number; newEntities: number; entityConflicts: number; readiness: Readiness; canProceedToReview: boolean; requiresManualReview: boolean } };

export type AnalysisCatalogRow = { id: string; title: string; subtitle: string | null; originalTitle: string | null; author: string; language: string | null; country: string | null; firstPublishedYear: number | null; sourceName: string | null; sourceUrl: string | null; editionCount: number };
export type AnalysisEditionRow = { id: string; catalogBookId: string; catalogTitle: string; titleOverride: string | null; translator: string | null; publisher: string | null; isbn10: string | null; isbn13: string | null; publishedYear: number | null; pageCount: number | null; sourceName: string | null; sourceUrl: string | null; sourceEditionCode: string | null };
export type AnalysisReferenceRow = { id: string; type: EntityAnalysis["type"]; name: string; slug: string | null; originalName: string | null };
export type AnalysisData = { catalogs: AnalysisCatalogRow[]; editions: AnalysisEditionRow[]; references: AnalysisReferenceRow[]; externalLinks: Array<{ catalogBookId: string; editionId: string | null; url: string }> };

export function analyzeIranKetabExtraction(extraction: IranKetabExtractionEnvelope, data: AnalysisData): IranKetabMatchAnalysis {
  const conflicts: AnalysisIssue[] = []; const warnings: AnalysisIssue[] = [];
  const catalogCandidates = analyzeCatalog(extraction, data, conflicts);
  const selected = catalogCandidates.find(candidate => candidate.confidence === "EXACT") ?? null;
  const catalogStatus: CatalogStatus = conflicts.some(item => item.target === "CATALOG" && item.severity === "CRITICAL") ? "CONFLICT" : selected ? "EXACT_MATCH" : catalogCandidates.length ? "POSSIBLE_MATCH" : "NEW";
  const entities = analyzeEntities(extraction, data.references);
  for (const entity of entities) {
    if (entity.status === "AMBIGUOUS" || entity.status === "CONFLICT") conflicts.push(issue("ENTITY", "WARNING", `تطبیق ${entity.extractedName} مبهم است و باید بررسی شود.`, false, "REVIEW_DIFFERENCE"));
  }
  const editions = extraction.editions.map((edition, extractedIndex) => analyzeEdition(extraction, edition, extractedIndex, data.editions, selected?.id ?? null, conflicts, warnings));
  if (!extraction.book.authors.length) conflicts.push(issue("CATALOG", "CRITICAL", "نویسنده کتاب استخراج نشده است.", true, "DO_NOT_OVERWRITE"));
  if (!extraction.editions.length) conflicts.push(issue("CATALOG", "CRITICAL", "هیچ نسخه معتبری استخراج نشده است.", true, "DO_NOT_OVERWRITE"));
  const exactEntities = entities.filter(item => item.status === "EXACT_MATCH" || item.status === "STRONG_MATCH").length;
  const possibleEntities = entities.filter(item => item.status === "POSSIBLE_MATCH" || item.status === "AMBIGUOUS").length;
  const newEntities = entities.filter(item => item.status === "NEW").length;
  const entityConflicts = entities.filter(item => item.status === "CONFLICT" || item.status === "AMBIGUOUS").length;
  const editionConflicts = editions.filter(item => item.status === "CONFLICT").length;
  const insufficient = editions.some(item => item.status === "INSUFFICIENT_DATA") || !extraction.book.authors.length;
  // Same-title books with different authors are common and are only weak
  // candidates. They should not block auto-import of a distinct book.
  const plausibleCatalogCandidates = catalogCandidates.filter(
    candidate => candidate.confidence === "HIGH" || candidate.confidence === "MEDIUM",
  );
  const catalogAmbiguous = catalogStatus === "POSSIBLE_MATCH" && plausibleCatalogCandidates.length > 1;
  const entityAmbiguous = entities.some(item => item.requiresManualSelection);
  const readiness: Readiness = conflicts.some(item => item.blocksImport) || editionConflicts > 0 ? "BLOCKED_BY_CONFLICT" : insufficient ? "INSUFFICIENT_DATA" : catalogAmbiguous ? "REQUIRES_CATALOG_SELECTION" : entityAmbiguous ? "REQUIRES_ENTITY_SELECTION" : "READY_FOR_REVIEW";
  return { catalog: { status: catalogStatus, selected, candidates: catalogCandidates }, editions, entities, conflicts: conflicts.filter(item => item.severity === "CRITICAL"), warnings: [...warnings, ...conflicts.filter(item => item.severity !== "CRITICAL")], summary: { catalogStatus, totalExtractedEditions: extraction.editions.length, newEditions: editions.filter(item => item.status === "NEW").length, exactEditionMatches: editions.filter(item => item.status === "EXACT_MATCH").length, possibleEditionMatches: editions.filter(item => item.status === "POSSIBLE_MATCH").length, conflictingEditions: editionConflicts, exactEntityMatches: exactEntities, possibleEntityMatches: possibleEntities, newEntities, entityConflicts, readiness, canProceedToReview: readiness === "READY_FOR_REVIEW", requiresManualReview: readiness !== "READY_FOR_REVIEW" } };
}

function analyzeCatalog(extraction: IranKetabExtractionEnvelope, data: AnalysisData, conflicts: AnalysisIssue[]): Candidate[] {
  const canonical = canonicalize(extraction.source.canonicalUrl);
  const linkedCatalogIds = new Set(data.externalLinks.filter(link => canonicalize(link.url) === canonical).map(link => link.catalogBookId));
  const authors = normalizedSet(extraction.book.authors.map(item => item.name));
  const title = comparable(extraction.book.title); const original = comparable(extraction.book.originalTitle);
  const candidates: Candidate[] = data.catalogs.map((row): Candidate | null => {
    const reasons: string[] = []; let confidence: MatchConfidence = "NONE";
    const sourceMatch = canonicalize(row.sourceUrl) === canonical || linkedCatalogIds.has(row.id);
    const rowAuthors = normalizedSet(splitMultiValueText(row.author)); const sameAuthors = setsEqual(authors, rowAuthors);
    if (sourceMatch) { confidence = "EXACT"; reasons.push("لینک canonical ایران‌کتاب قبلاً به این کتاب متصل است."); }
    else if (comparable(row.title) === title && sameAuthors && (!original || !row.originalTitle || comparable(row.originalTitle) === original)) { confidence = "HIGH"; reasons.push("عنوان و مجموعه نویسندگان تطبیق دارند."); }
    else if ((comparable(row.title) === title || (original && comparable(row.originalTitle) === original)) && intersects(authors, rowAuthors)) { confidence = "MEDIUM"; reasons.push("عنوان و بخشی از نویسندگان مشابه‌اند."); }
    else if (comparable(row.title) === title || (original && comparable(row.originalTitle) === original)) { confidence = "LOW"; reasons.push("عنوان مشابه است اما نویسندگان سازگار نیستند."); }
    else return null;
    const comparisons = [compare("عنوان", extraction.book.title, row.title), compare("عنوان اصلی", extraction.book.originalTitle, row.originalTitle), compare("نویسندگان", extraction.book.authors.map(item=>item.name), splitMultiValueText(row.author)), compare("سال نخستین انتشار", extraction.book.firstPublishedYear, row.firstPublishedYear), compare("URL منبع", canonical, canonicalize(row.sourceUrl))];
    if (sourceMatch && !sameAuthors && row.author) conflicts.push(issue("CATALOG", "CRITICAL", "لینک ایران‌کتاب به کتابی با نویسندگان ناسازگار متصل است.", true, "DO_NOT_OVERWRITE"));
    return { id: row.id, title: row.title, authors: row.author, originalTitle: row.originalTitle, editionCount: row.editionCount, confidence, reasons, comparisons, adminHref: `/admin/books/${row.id}/edit`, safeToReuse: confidence === "EXACT" || (confidence === "HIGH" && sameAuthors) };
  }).filter((item): item is Candidate => item !== null).sort((a,b)=>rank(b.confidence)-rank(a.confidence)).slice(0,5);
  if (candidates.filter(item=>item.confidence === "HIGH").length > 1) conflicts.push(issue("CATALOG", "WARNING", "چند کتاب با احتمال بالا پیدا شد؛ انتخاب کاتالوگ باید دستی باشد.", false, "REVIEW_DIFFERENCE"));
  return candidates;
}

function analyzeEdition(extraction: IranKetabExtractionEnvelope, edition: IranKetabExtractionEnvelope["editions"][number], extractedIndex: number, rows: AnalysisEditionRow[], selectedCatalogId: string | null, conflicts: AnalysisIssue[], warnings: AnalysisIssue[]): EditionAnalysis {
  const isbn13 = classifyIsbn(edition.isbn13, 13); const isbn10 = classifyIsbn(edition.isbn10, 10); const sourceUrl = canonicalize(edition.sourceUrl);
  if (isbn13.state === "INVALID" || isbn10.state === "INVALID") warnings.push(issue("EDITION", "WARNING", `شابک نسخه ${edition.sourceEditionCode} نامعتبر است.`, false, "REVIEW_DIFFERENCE", extractedIndex));
  const byCode = rows.filter(row => row.sourceName?.toLowerCase() === "iranketab" && row.sourceEditionCode === edition.sourceEditionCode);
  const candidates = unique(byCode);
  const strong = candidates;
  const reasons: string[]=[]; let status: EditionStatus="NEW"; let confidence: MatchConfidence="NONE"; let chosen: AnalysisEditionRow|undefined;
  if (strong.length > 1) { status="CONFLICT"; confidence="HIGH"; reasons.push("چند نسخه موجود با شناسه قوی یکسان پیدا شد."); conflicts.push(issue("EDITION","CRITICAL",`نسخه ${edition.sourceEditionCode} با چند رکورد موجود تطبیق دارد.`,true,"DO_NOT_OVERWRITE",extractedIndex)); }
  else if (strong.length === 1) { chosen=strong[0]; const incompatible=selectedCatalogId && chosen.catalogBookId!==selectedCatalogId; if(incompatible){status="CONFLICT";confidence="EXACT";reasons.push("کد نسخه متعلق به کاتالوگ دیگری است.");conflicts.push(issue("EDITION","CRITICAL",`شناسه نسخه ${edition.sourceEditionCode} به کتاب دیگری تعلق دارد.`,true,"DO_NOT_OVERWRITE",extractedIndex));} else {status="EXACT_MATCH";confidence="EXACT";reasons.push("کد نسخه ایران‌کتاب تطبیق دقیق دارد.");} }
  else if (!edition.publisher.name && !edition.titleOverride && !isbn13.value && !isbn10.value) {status="INSUFFICIENT_DATA";confidence="NONE";reasons.push("اطلاعات شناسایی نسخه کافی نیست.");}
  else { const loose=rows.filter(row=> comparable(row.publisher)===comparable(edition.publisher.name) && setsEqual(normalizedSet(splitMultiValueText(row.translator)),normalizedSet(edition.translators.map(item=>item.name))) && row.publishedYear===edition.publishedYear && row.pageCount===edition.pageCount); if(loose.length===1){chosen=loose[0];status="POSSIBLE_MATCH";confidence="MEDIUM";reasons.push("مشخصات ناشر، مترجم، سال و صفحه مشابه‌اند.");} else if(loose.length>1){status="CONFLICT";confidence="MEDIUM";reasons.push("چند نسخه با مشخصات مشابه پیدا شد.");} }
  const comparisons=chosen?[compare("ناشر",edition.publisher.name,chosen.publisher),compare("مترجمان",edition.translators.map(item=>item.name),splitMultiValueText(chosen.translator)),compare("ISBN-10",isbn10.value,normalizeIsbn(chosen.isbn10)),compare("ISBN-13",isbn13.value,normalizeIsbn(chosen.isbn13)),compare("سال انتشار",edition.publishedYear,chosen.publishedYear),compare("تعداد صفحات",edition.pageCount,chosen.pageCount),compare("کد نسخه منبع",edition.sourceEditionCode,chosen.sourceEditionCode),compare("URL منبع",sourceUrl,canonicalize(chosen.sourceUrl))]:[];
  return { extractedIndex, sourceEditionCode: edition.sourceEditionCode, status, confidence, existingEditionId: chosen?.id??null, existingCatalogId: chosen?.catalogBookId??null, existingCatalogTitle: chosen?.catalogTitle??null, reasons, comparisons, adminHref: chosen?`/admin/books/${chosen.catalogBookId}/edit`:null, belongsToSelectedCatalog: chosen&&selectedCatalogId?chosen.catalogBookId===selectedCatalogId:null };
}

function analyzeEntities(extraction: IranKetabExtractionEnvelope, rows: AnalysisReferenceRow[]): EntityAnalysis[] {
  const inputs: Array<{ type: EntityAnalysis["type"]; name: string }> = [
    ...extraction.book.authors.map(item => ({ type: "AUTHOR" as const, name: item.name })),
    ...extraction.editions.flatMap(item => item.translators.map(person => ({ type: "TRANSLATOR" as const, name: person.name }))),
    ...extraction.editions.map(item => ({ type: "PUBLISHER" as const, name: item.publisher.name })),
    ...extraction.book.genres.map(item => ({ type: "GENRE" as const, name: item.name })),
    ...(extraction.book.country ? [{ type: "COUNTRY" as const, name: extraction.book.country.name }] : []),
  ];
  const seen = new Set<string>();
  return inputs.filter(item => {
    const key = `${item.type}:${normalizeReferenceName(item.name)}`;
    if (!item.name || seen.has(key)) return false;
    seen.add(key);
    return true;
  }).map(input => {
    const normalizedName = normalizeReferenceName(input.name);
    const exact = rows.filter(row => row.type === input.type && normalizeReferenceName(row.name) === normalizedName);
    const possible = rows.filter(row => row.type === input.type && !exact.includes(row) && similar(normalizedName, normalizeReferenceName(row.name))).slice(0, 3);
    const matched = exact[0];
    const ambiguous = exact.length > 1;
    return { type: input.type, extractedName: input.name, normalizedName, status: ambiguous ? "AMBIGUOUS" : matched ? "EXACT_MATCH" : possible.length === 1 ? "POSSIBLE_MATCH" : "NEW", confidence: ambiguous ? "MEDIUM" : matched ? "EXACT" : possible.length === 1 ? "LOW" : "NONE", candidate: matched ? { id: matched.id, name: matched.name, adminHref: referenceHref(matched) } : possible.length === 1 ? { id: possible[0].id, name: possible[0].name, adminHref: referenceHref(possible[0]) } : null, alternatives: [...exact.slice(1), ...possible].map(row => ({ id: row.id, name: row.name, adminHref: referenceHref(row) })), requiresManualSelection: ambiguous || possible.length > 1 };
  });
}
function referenceHref(row:AnalysisReferenceRow){const paths={AUTHOR:"authors",TRANSLATOR:"translators",PUBLISHER:"publishers",GENRE:"categories",COUNTRY:"references"} as const;return `/admin/${paths[row.type]}`;}
function classifyIsbn(value:string|null,length:number){const normalized=normalizeIsbn(value);if(!normalized)return{state:"MISSING" as const,value:null};if(!new RegExp(`^[0-9Xx]{${length}}$`).test(normalized))return{state:"INVALID" as const,value:null};return{state:"VALID" as const,value:normalized.toUpperCase()};}
function compare(field:string,extractedValue:FieldComparison["extractedValue"],existingValue:FieldComparison["existingValue"]):FieldComparison{if(extractedValue==null||extractedValue===""||(Array.isArray(extractedValue)&&!extractedValue.length))return{field,extractedValue,existingValue,status:"MISSING_IN_SOURCE",severity:"INFO",recommendation:"KEEP_EXISTING"};if(existingValue==null||existingValue===""||(Array.isArray(existingValue)&&!existingValue.length))return{field,extractedValue,existingValue,status:"MISSING_IN_DATABASE",severity:"WARNING",recommendation:"FILL_MISSING"};const equal=Array.isArray(extractedValue)&&Array.isArray(existingValue)?setsEqual(normalizedSet(extractedValue),normalizedSet(existingValue)):String(extractedValue)===String(existingValue);const normalized=Array.isArray(extractedValue)&&Array.isArray(existingValue)?equal:comparable(String(extractedValue))===comparable(String(existingValue));return{field,extractedValue,existingValue,status:equal?"SAME":normalized?"NORMALIZED_EQUAL":"DIFFERENT",severity:equal||normalized?"INFO":"WARNING",recommendation:equal||normalized?"KEEP_EXISTING":"REVIEW_DIFFERENCE"};}
function issue(target:AnalysisIssue["target"],severity:AnalysisIssue["severity"],message:string,blocksImport:boolean,recommendation:AnalysisIssue["recommendation"],extractedIndex?:number):AnalysisIssue{return{id:`${target}:${severity}:${message}:${extractedIndex??""}`,target,severity,message,blocksImport,recommendation,extractedIndex};}
function canonicalize(value:string|null|undefined){if(!value)return"";try{const url=new URL(value);url.hash="";url.hostname="www.iranketab.ir";return url.toString().replace(/\/$/,"");}catch{return value.trim();}}
function comparable(value:string|null|undefined){return value?normalizeReferenceName(value):"";} function normalizedSet(values:string[]){return new Set(values.flatMap(splitMultiValueText).map(comparable).filter(Boolean));} function setsEqual(a:Set<string>,b:Set<string>){return a.size===b.size&&[...a].every(item=>b.has(item));} function intersects(a:Set<string>,b:Set<string>){return [...a].some(item=>b.has(item));} function unique<T extends {id:string}>(rows:T[]){return [...new Map(rows.map(item=>[item.id,item])).values()];} function rank(value:MatchConfidence){return({EXACT:5,HIGH:4,MEDIUM:3,LOW:2,NONE:1})[value];} function similar(a:string,b:string){return a.length>3&&b.length>3&&(a.includes(b)||b.includes(a));}
