import { and, arrayContains, eq, ilike, inArray, isNull, or, sql } from "drizzle-orm";
import type { IranKetabExtractionEnvelope } from "@ghafaseh/iranketab-extractor";
import { db } from "@/db";
import { BookEdition, BookExternalLink, CatalogBook, ReferenceItem } from "@/db/schema";
import type { AnalysisData } from "./match-analysis";

/** Read-only candidate loader. It makes bounded batched selects only; no write API is imported. */
export async function loadIranKetabAnalysisData(extraction: IranKetabExtractionEnvelope): Promise<AnalysisData> {
  const canonicalUrls = sourceVariants(extraction.source.canonicalUrl);
  const titles = unique([extraction.book.title, extraction.book.originalTitle].filter((value): value is string => Boolean(value)));
  const codes = unique(extraction.editions.map(item => item.sourceEditionCode).filter(Boolean));
  const [catalogRows, editionRows, linkRows, referenceRows] = await Promise.all([
    db.select({ id:CatalogBook.id,title:CatalogBook.title,subtitle:CatalogBook.subtitle,originalTitle:CatalogBook.originalTitle,author:CatalogBook.author,language:CatalogBook.language,country:CatalogBook.country,firstPublishedYear:CatalogBook.firstPublishedYear,sourceName:CatalogBook.sourceName,sourceUrl:CatalogBook.sourceUrl,editionCount:sql<number>`count(${BookEdition.id})::int` }).from(CatalogBook).leftJoin(BookEdition,eq(BookEdition.catalogBookId,CatalogBook.id)).where(or(...[...canonicalUrls.map(url=>eq(CatalogBook.sourceUrl,url)),...titles.flatMap(title=>[ilike(CatalogBook.title,title),ilike(CatalogBook.originalTitle,title)])])).groupBy(CatalogBook.id).limit(20),
    db.select({ id:BookEdition.id,catalogBookId:BookEdition.catalogBookId,catalogTitle:CatalogBook.title,titleOverride:BookEdition.titleOverride,translator:BookEdition.translator,publisher:BookEdition.publisher,isbn10:BookEdition.isbn10,isbn13:BookEdition.isbn13,publishedYear:BookEdition.publishedYear,pageCount:BookEdition.pageCount,sourceName:BookEdition.sourceName,sourceUrl:BookEdition.sourceUrl,sourceEditionCode:BookEdition.sourceEditionCode }).from(BookEdition).innerJoin(CatalogBook,eq(CatalogBook.id,BookEdition.catalogBookId)).where(or(...(codes.length?[and(eq(BookEdition.sourceName,"iranketab"),inArray(BookEdition.sourceEditionCode,codes))]:[]),...canonicalUrls.map(url=>eq(BookEdition.sourceUrl,url)))).limit(100),
    db.select({catalogBookId:BookExternalLink.catalogBookId,editionId:BookExternalLink.editionId,url:BookExternalLink.url}).from(BookExternalLink).where(and(eq(BookExternalLink.provider,"iranketab"),inArray(BookExternalLink.url,canonicalUrls))).limit(20),
    loadReferences(extraction),
  ]);
  const linkedCatalogIds=unique(linkRows.map(row=>row.catalogBookId));
  const linkedCatalogs=linkedCatalogIds.length?await db.select({ id:CatalogBook.id,title:CatalogBook.title,subtitle:CatalogBook.subtitle,originalTitle:CatalogBook.originalTitle,author:CatalogBook.author,language:CatalogBook.language,country:CatalogBook.country,firstPublishedYear:CatalogBook.firstPublishedYear,sourceName:CatalogBook.sourceName,sourceUrl:CatalogBook.sourceUrl,editionCount:sql<number>`count(${BookEdition.id})::int` }).from(CatalogBook).leftJoin(BookEdition,eq(BookEdition.catalogBookId,CatalogBook.id)).where(inArray(CatalogBook.id,linkedCatalogIds)).groupBy(CatalogBook.id):[];
  return {catalogs:uniqueById([...catalogRows,...linkedCatalogs]),editions:editionRows,references:referenceRows,externalLinks:linkRows};
}

async function loadReferences(extraction: IranKetabExtractionEnvelope) {
  const groups = [
    { type: "AUTHOR" as const, names: extraction.book.authors.map((item) => item.name) },
    { type: "TRANSLATOR" as const, names: extraction.editions.flatMap((item) => item.translators.map((person) => person.name)) },
    { type: "PUBLISHER" as const, names: extraction.editions.map((item) => item.publisher.name) },
    { type: "GENRE" as const, names: extraction.book.genres.map((item) => item.name) },
    { type: "COUNTRY" as const, names: extraction.book.country ? [extraction.book.country.name] : [] },
  ];
  const results = await Promise.all(groups.filter((group) => group.names.length).map(async (group) => {
    const role = group.type === "AUTHOR" || group.type === "TRANSLATOR"
      ? and(arrayContains(ReferenceItem.roles, [group.type]), isNull(ReferenceItem.canonicalReferenceId))
      : eq(ReferenceItem.type, group.type);
    const rows = await db.select({
      id: ReferenceItem.id,
      name: ReferenceItem.name,
      slug: ReferenceItem.slug,
      originalName: ReferenceItem.originalName,
    }).from(ReferenceItem).where(and(
      role,
      or(...unique(group.names).flatMap((name) => [ilike(ReferenceItem.name, name), ilike(ReferenceItem.name, `%${name}%`)])),
    )).limit(40);
    return rows.map((row) => ({ ...row, type: group.type }));
  }));
  return results.flat();
}
function sourceVariants(value:string){try{const url=new URL(value);url.hash="";const path=url.pathname;return unique([`https://iranketab.ir${path}`,`https://www.iranketab.ir${path}`]);}catch{return[value];}} function unique<T>(items:T[]){return[...new Set(items)];} function uniqueById<T extends{id:string}>(items:T[]){return[...new Map(items.map(item=>[item.id,item])).values()];}
