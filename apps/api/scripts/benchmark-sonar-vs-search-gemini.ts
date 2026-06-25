/* eslint-disable no-console */
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { performance } from 'node:perf_hooks';
import { z } from 'zod';
import { OpenRouterClient, parseJsonObject, type ChatMessage, type JsonCompletionResult } from '../src/ai/openrouter.client';

type Path = 'search+gemini' | 'sonar';
const cases = [
  { query:'Apple AirPods Pro 2 USB-C',brand:'Apple',terms:['airpods','pro','2'] },
  { query:'Sony WH-1000XM5',brand:'Sony',terms:['wh-1000xm5'] },
  { query:'Samsung Galaxy S24 Ultra 256GB',brand:'Samsung',terms:['s24','ultra'] },
  { query:'Garmin fenix 7 Pro Solar 47 mm',brand:'Garmin',terms:['fenix','7','pro','solar'] },
  { query:'ASUS ROG Ally X RC72LA',brand:'ASUS',terms:['rog','ally','x','rc72la'] },
  { query:'Canon EOS R6 Mark II',brand:'Canon',terms:['eos','r6','mark','ii'] },
  { query:'LG OLED evo C4 55 Zoll OLED55C47LA',brand:'LG',terms:['c4','oled55c47la'] },
  { query:'Dyson V15 Detect Absolute',brand:'Dyson',terms:['v15','detect'] },
  { query:'Roborock S8 MaxV Ultra',brand:'Roborock',terms:['s8','maxv','ultra'] },
  { query:'Bosch Serie 6 WGG244Z40 Waschmaschine',brand:'Bosch',terms:['wgg244z40'] },
  { query:'Miele G 7110 SC AutoDos',brand:'Miele',terms:['g','7110','autodos'] },
  { query:'Siemens EQ.6 plus s700 TE657503DE',brand:'Siemens',terms:['eq6','s700','te657503de'] },
  { query:'Ninja Foodi Dual Zone AF400EU',brand:'Ninja',terms:['af400eu'] },
  { query:'Braun Series 9 Pro+ 9577cc',brand:'Braun',terms:['9577cc'] },
  { query:'Kaercher K5 Power Control Home',brand:'Kaercher',terms:['k5','power','control'] },
  { query:'Makita DDF484RTJ',brand:'Makita',terms:['ddf484rtj'] },
  { query:'AVM FRITZ!Box 7590 AX',brand:'AVM',terms:['7590','ax'] },
  { query:'Synology DiskStation DS923+',brand:'Synology',terms:['ds923'] },
  { query:'Epson EcoTank ET-4850',brand:'Epson',terms:['et-4850'] },
  { query:'LEGO Technic Mercedes-AMG F1 W14 E Performance 42171',brand:'LEGO',terms:['42171'] },
] as const;

const schema=z.object({canonicalName:z.string().min(2),brand:z.string().nullable(),description:z.string().nullable(),specs:z.array(z.object({label:z.string(),value:z.string()})).max(10).default([]),productUrl:z.string().url().nullable(),found:z.coerce.boolean()});
type Row={path:Path;query:string;ok:boolean;brandCorrect:boolean;nameCorrect:boolean;hasUrl:boolean;specs:number;citations:number;latencyMs:number;tokens:number;costUsd:number;model:string;error?:string};
const key=process.env.OPENROUTER_API_KEY?.trim(); if(!key)throw new Error('OPENROUTER_API_KEY is required');
const common={apiKey:key,siteUrl:process.env.OPENROUTER_SITE_URL||'https://wudly.app',appTitle:'Wudly Sonar Benchmark',exactModelOnly:true} as const;
const gemini=new OpenRouterClient({...common,model:'google/gemini-3.1-flash-lite',webSearchEngine:'perplexity',webSearchMaxResults:8});
const sonar=new OpenRouterClient({...common,model:'perplexity/sonar'});
void main();

async function main(){const rows:Row[]=[];for(let i=0;i<cases.length;i++){const c=cases[i]!;const [a,b]=await Promise.all([run('search+gemini',c,gemini,true),run('sonar',c,sonar,false)]);rows.push(a,b);console.warn(`[${i+1}/20] ${c.query}: search+gemini=${a.ok?'PASS':'FAIL'} sonar=${b.ok?'PASS':'FAIL'}`);}mkdirSync(resolve('tmp'),{recursive:true});writeFileSync(resolve('tmp/benchmark-sonar-vs-search-gemini.json'),JSON.stringify(rows,null,2));writeFileSync(resolve('tmp/benchmark-sonar-vs-search-gemini.md'),markdown(rows));console.table(rows.map(r=>({path:r.path,query:r.query,ok:r.ok,score:Number(r.brandCorrect)+Number(r.nameCorrect)+Number(r.hasUrl),specs:r.specs,citations:r.citations,latencyMs:r.latencyMs,costUsd:r.costUsd.toFixed(5),model:r.model,error:r.error??''})));for(const path of ['search+gemini','sonar'] as const){const x=rows.filter(r=>r.path===path);console.log(`\n${path}`,summary(x));}}
async function run(path:Path,c:typeof cases[number],client:OpenRouterClient,online:boolean):Promise<Row>{const start=performance.now();const result=await client.completeJsonDetailed(messages(c.query),{online,temperature:.1,maxTokens:700,timeoutMs:60000});return score(path,c,result,start);}
function messages(query:string):ChatMessage[]{return [{role:'system',content:'Recherchiere exakt dieses reale Konsumprodukt im Web. Erfinde nichts. Liefere den offiziellen Namen, Marke, einen sachlichen deutschen Beschreibungssatz, bis zu 8 sichere technische Eigenschaften und bevorzugt die offizielle Herstellerseite. Antworte ausschließlich als JSON: {"canonicalName":string,"brand":string|null,"description":string|null,"specs":[{"label":string,"value":string}],"productUrl":string|null,"found":boolean}.'},{role:'user',content:`Produkt: ${query}`}];}
function score(path:Path,c:typeof cases[number],r:JsonCompletionResult,start:number):Row{const p=schema.safeParse(parseJsonObject(r.content??null));if(!r.ok||!p.success)return {path,query:c.query,ok:false,brandCorrect:false,nameCorrect:false,hasUrl:false,specs:0,citations:0,latencyMs:Math.round(performance.now()-start),tokens:r.usage?.totalTokens??0,costUsd:r.usage?.costUsd??0,model:r.model,error:r.error??'invalid-json'};const name=norm(p.data.canonicalName);const brandCorrect=norm(p.data.brand??'').includes(norm(c.brand));const nameCorrect=c.terms.every(t=>name.includes(norm(t)));return {path,query:c.query,ok:p.data.found&&brandCorrect&&nameCorrect,brandCorrect,nameCorrect,hasUrl:Boolean(p.data.productUrl),specs:p.data.specs.length,citations:r.citations.length,latencyMs:Math.round(performance.now()-start),tokens:r.usage?.totalTokens??0,costUsd:r.usage?.costUsd??0,model:r.model,error:p.data.found?undefined:'found=false'};}
function summary(x:Row[]){return {cases:x.length,successRate:pct(x.filter(r=>r.ok).length,x.length),validUrlRate:pct(x.filter(r=>r.hasUrl).length,x.length),avgSpecs:avg(x.map(r=>r.specs)),avgCitations:avg(x.map(r=>r.citations)),avgLatencyMs:avg(x.map(r=>r.latencyMs)),totalTokens:sum(x.map(r=>r.tokens)),totalCostUsd:Number(sum(x.map(r=>r.costUsd)).toFixed(5))};}
function markdown(rows:Row[]){const a=summary(rows.filter(r=>r.path==='search+gemini'));const b=summary(rows.filter(r=>r.path==='sonar'));return ['# Perplexity Search + Gemini vs. Sonar','',`Stand: ${new Date().toISOString()}`,'','| Pfad | Erfolgsquote | URL | Ø Specs | Ø Citations | Ø Latenz | Gesamtkosten |','|---|---:|---:|---:|---:|---:|---:|',`| Search + Gemini | ${a.successRate} | ${a.validUrlRate} | ${a.avgSpecs} | ${a.avgCitations} | ${a.avgLatencyMs} ms | $${a.totalCostUsd} |`,`| Sonar | ${b.successRate} | ${b.validUrlRate} | ${b.avgSpecs} | ${b.avgCitations} | ${b.avgLatencyMs} ms | $${b.totalCostUsd} |`,'','## Produkte','','| Produkt | Search + Gemini | Sonar |','|---|---:|---:|',...cases.map(c=>{const x=rows.find(r=>r.query===c.query&&r.path==='search+gemini')!;const y=rows.find(r=>r.query===c.query&&r.path==='sonar')!;return `| ${c.query} | ${x.ok?'PASS':'FAIL'} | ${y.ok?'PASS':'FAIL'} |`;})].join('\n');}
function norm(v:string){return v.toLocaleLowerCase('de-DE').replace(/[^a-z0-9]+/g,'');}function pct(n:number,d:number){return `${(n/d*100).toFixed(1)}%`;}function sum(v:number[]){return v.reduce((a,b)=>a+b,0);}function avg(v:number[]){return Math.round(sum(v)/v.length*100)/100;}
