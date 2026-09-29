import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { extractIranKetabBook } from "@ghafaseh/iranketab-extractor";
import { analyzeIranKetabExtraction, type AnalysisData } from "./match-analysis";

async function fixture(){return extractIranKetabBook({url:"https://www.iranketab.ir/book/1045-white-nights",html:await readFile("packages/iranketab-extractor/fixtures/white-nights/raw-page.html","utf8")});}
const base:AnalysisData={catalogs:[],editions:[],references:[],externalLinks:[]};
test("source URL match is exact across www and edition fragments",async()=>{const extraction=await fixture();const analysis=analyzeIranKetabExtraction(extraction,{...base,catalogs:[{id:"book-1",title:extraction.book.title,subtitle:null,originalTitle:extraction.book.originalTitle,author:"فئودور داستایفسکی",language:"fa",country:"روسیه",firstPublishedYear:1848,sourceName:"iranketab",sourceUrl:"https://iranketab.ir/book/1045-white-nights",editionCount:2}],externalLinks:[{catalogBookId:"book-1",editionId:null,url:"https://www.iranketab.ir/book/1045-white-nights#pts=2405"}]});assert.equal(analysis.catalog.status,"EXACT_MATCH");assert.equal(analysis.catalog.selected?.id,"book-1");});
test("same title with incompatible authors remains a possible match",async()=>{const extraction=await fixture();const analysis=analyzeIranKetabExtraction(extraction,{...base,catalogs:[{id:"book-2",title:extraction.book.title,subtitle:null,originalTitle:null,author:"نویسنده دیگر",language:"fa",country:null,firstPublishedYear:null,sourceName:null,sourceUrl:null,editionCount:1}]});assert.equal(analysis.catalog.status,"POSSIBLE_MATCH");assert.equal(analysis.catalog.candidates.length,1);assert.equal(analysis.catalog.candidates[0]?.confidence,"LOW");});
test("ISBN and source-code conflicts block readiness",async()=>{const extraction=await fixture();const edition=extraction.editions[0]!;const analysis=analyzeIranKetabExtraction(extraction,{...base,catalogs:[{id:"selected-book",title:extraction.book.title,subtitle:null,originalTitle:extraction.book.originalTitle,author:"فئودور داستایفسکی",language:"fa",country:"روسیه",firstPublishedYear:1848,sourceName:"iranketab",sourceUrl:extraction.source.canonicalUrl,editionCount:1}],editions:[{id:"edition-1",catalogBookId:"other-book",catalogTitle:"اثر دیگر",titleOverride:null,translator:"سروش حبیبی",publisher:"ماهی",isbn10:null,isbn13:edition.isbn13,publishedYear:edition.publishedYear,pageCount:edition.pageCount,sourceName:"iranketab",sourceUrl:"https://www.iranketab.ir/book/other#pts=2405",sourceEditionCode:edition.sourceEditionCode}]});assert.equal(analysis.editions[0]?.status,"CONFLICT");assert.equal(analysis.summary.readiness,"BLOCKED_BY_CONFLICT");});
test("entity matching reuses Persian normalization and reports ambiguous candidates",async()=>{const extraction=await fixture();const analysis=analyzeIranKetabExtraction(extraction,{...base,references:[{id:"a1",type:"AUTHOR",name:"فئودور داستایفسکی",slug:null,originalName:null},{id:"p1",type:"PUBLISHER",name:"ماهی",slug:null,originalName:null},{id:"p2",type:"PUBLISHER",name:"ماهی",slug:null,originalName:null}]});const author=analysis.entities.find(item=>item.type==="AUTHOR");const publisher=analysis.entities.find(item=>item.type==="PUBLISHER");assert.equal(author?.status,"EXACT_MATCH");assert.equal(publisher?.status,"AMBIGUOUS");assert.equal(analysis.summary.requiresManualReview,true);});
test("no database candidates produces new preview without writes",async()=>{const analysis=analyzeIranKetabExtraction(await fixture(),base);assert.equal(analysis.catalog.status,"NEW");assert.ok(analysis.summary.newEditions>0);assert.equal(analysis.conflicts.length,0);});

test("same-title books with different authors do not block auto-import", async () => {
  const extraction = await fixture();
  const analysis = analyzeIranKetabExtraction(extraction, {
    ...base,
    catalogs: ["book-1", "book-2"].map((id) => ({
      id,
      title: extraction.book.title,
      subtitle: null,
      originalTitle: null,
      author: "نویسنده‌ای دیگر",
      language: "fa",
      country: null,
      firstPublishedYear: null,
      sourceName: null,
      sourceUrl: null,
      editionCount: 1,
    })),
  });

  assert.ok(analysis.catalog.candidates.every((candidate) => candidate.confidence === "LOW"));
  assert.equal(analysis.summary.readiness, "READY_FOR_REVIEW");
});
