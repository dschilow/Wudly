/* eslint-disable no-console */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ConfigService } from '@nestjs/config';
import { Prisma, PrismaClient } from '@prisma/client';
import { normalizeProductName } from '@wudly/shared';
import { z } from 'zod';
import { BraveSearchService } from '../src/ai/brave-search.service';
import { ProductImageService } from '../src/products/product-image.service';
import { OpenRouterClient, parseJsonObject, type ChatMessage } from '../src/ai/openrouter.client';

// `railway run` exposes the private DB URL by default, which is unreachable
// from a developer machine. Prefer the public proxy for this one-off admin job.
if (process.env.CATALOG_DATABASE_URL || process.env.DATABASE_PUBLIC_URL) {
  process.env.DATABASE_URL = process.env.CATALOG_DATABASE_URL || process.env.DATABASE_PUBLIC_URL;
}

const candidates = [
  ['Apple AirPods Pro 2 USB-C','Apple','airpods pro 2'],['Sony WH-1000XM5','Sony','wh-1000xm5'],
  ['Bose QuietComfort Ultra Headphones','Bose','quietcomfort ultra'],['Sennheiser Momentum 4 Wireless','Sennheiser','momentum 4'],
  ['JBL Charge 5','JBL','charge 5'],['Sonos Era 300','Sonos','era 300'],
  ['Samsung Galaxy S24 Ultra 256GB','Samsung','s24 ultra'],['Apple iPhone 15 Pro 256GB','Apple','iphone 15 pro'],
  ['Google Pixel 8 Pro 256GB','Google','pixel 8 pro'],['OnePlus 12 256GB','OnePlus','oneplus 12'],
  ['Xiaomi 14 Ultra','Xiaomi','14 ultra'],['Nothing Phone (2)','Nothing','phone 2'],
  ['Apple Watch Series 9 45mm','Apple','watch series 9'],['Garmin fenix 7 Pro Solar 47 mm','Garmin','fenix 7 pro solar'],
  ['Samsung Galaxy Watch6 Classic 47mm','Samsung','watch6 classic'],['Fitbit Charge 6','Fitbit','charge 6'],
  ['Oura Ring Gen3 Horizon','Oura','ring gen3 horizon'],['Polar Vantage V3','Polar','vantage v3'],
  ['Nintendo Switch OLED','Nintendo','switch oled'],['Sony PlayStation 5 Slim','Sony','playstation 5 slim'],
  ['Microsoft Xbox Series X','Microsoft','xbox series x'],['Valve Steam Deck OLED 512GB','Valve','steam deck oled'],
  ['ASUS ROG Ally X RC72LA','ASUS','rog ally x rc72la'],['Meta Quest 3 128GB','Meta','quest 3'],
  ['Logitech MX Master 3S','Logitech','mx master 3s'],['Keychron Q1 Max','Keychron','q1 max'],
  ['Apple MacBook Air 13 M3','Apple','macbook air 13 m3'],['Dell XPS 13 9340','Dell','xps 13 9340'],
  ['Lenovo ThinkPad X1 Carbon Gen 12','Lenovo','x1 carbon gen 12'],['ASUS Zenbook 14 OLED UX3405','ASUS','ux3405'],
  ['Apple iPad Pro 11 M4','Apple','ipad pro 11 m4'],['Samsung Galaxy Tab S9 Ultra','Samsung','tab s9 ultra'],
  ['Canon EOS R6 Mark II','Canon','eos r6 mark ii'],['Sony Alpha 7 IV','Sony','alpha 7 iv'],
  ['Fujifilm X-T5','Fujifilm','x-t5'],['Nikon Z6 II','Nikon','z6 ii'],
  ['DJI Osmo Pocket 3 Creator Combo','DJI','osmo pocket 3'],['GoPro HERO12 Black','GoPro','hero12 black'],
  ['LG OLED evo C4 55 Zoll OLED55C47LA','LG','oled55c47la'],['Samsung Neo QLED QN90D 55 Zoll GQ55QN90DAT','Samsung','gq55qn90dat'],
  ['Sony Bravia 8 55 Zoll K-55XR80','Sony','k-55xr80'],['Philips OLED+ 908 55OLED908','Philips','55oled908'],
  ['Dyson V15 Detect Absolute','Dyson','v15 detect absolute'],['Miele Complete C3 Cat & Dog Flex','Miele','complete c3 cat dog'],
  ['Bosch Unlimited 7 BBS711W','Bosch','bbs711w'],['Roborock S8 MaxV Ultra','Roborock','s8 maxv ultra'],
  ['Dreame L20 Ultra','Dreame','l20 ultra'],['iRobot Roomba j7+','iRobot','roomba j7'],
  ['Bosch Serie 6 WGG244Z40 Waschmaschine','Bosch','wgg244z40'],['Miele W1 WWD320 WPS','Miele','wwd320'],
  ['Siemens iQ700 WG56B2A40','Siemens','wg56b2a40'],['AEG 8000 PowerCare LR8E75495','AEG','lr8e75495'],
  ['Bosch Serie 6 SMS6ZCI49E Geschirrspüler','Bosch','sms6zci49e'],['Miele G 7110 SC AutoDos','Miele','g 7110'],
  ['Siemens iQ500 SN65ZX07CE','Siemens','sn65zx07ce'],['Samsung Bespoke RB38C7B6AB1','Samsung','rb38c7b6ab1'],
  ['Liebherr CBNsda 5753 Prime','Liebherr','cbnsda 5753'],['Bosch Serie 6 KGN39AIBT','Bosch','kgn39aibt'],
  ['DeLonghi Magnifica Evo ECAM290.81.TB','DeLonghi','ecam290.81'],['Siemens EQ.6 plus s700 TE657503DE','Siemens','te657503de'],
  ['Philips LatteGo 5400 EP5447/90','Philips','ep5447'],['Jura E8 EB Piano Black','Jura','e8 eb'],
  ['Ninja Foodi Dual Zone AF400EU','Ninja','af400eu'],['Philips Airfryer XXL HD9650/90','Philips','hd9650'],
  ['KitchenAid Artisan 5KSM175PS','KitchenAid','5ksm175ps'],['Thermomix TM6','Vorwerk','thermomix tm6'],
  ['Sage Barista Express Impress SES876','Sage','ses876'],['Vitamix Ascent A3500i','Vitamix','a3500i'],
  ['Braun Series 9 Pro+ 9577cc','Braun','9577cc'],['Philips OneBlade Pro 360 QP6652/61','Philips','qp6652'],
  ['Oral-B iO 10 Cosmic Black','Oral-B','io 10'],['Dyson Supersonic HD07','Dyson','supersonic hd07'],
  ['Philips Lumea 9000 BRI958/00','Philips','bri958'],['Panasonic ER-DGP86','Panasonic','er-dgp86'],
  ['Kaercher K5 Power Control Home','Kaercher','k5 power control'],['Gardena smart SILENO city 500','Gardena','sileno city 500'],
  ['Weber Spirit EPX-325S GBS','Weber','epx-325s'],['Makita DDF484RTJ','Makita','ddf484rtj'],
  ['Bosch Professional GSR 18V-55','Bosch','gsr 18v-55'],['EcoFlow DELTA 2','EcoFlow','delta 2'],
  ['Anker SOLIX C1000','Anker','solix c1000'],['Jackery Explorer 1000 Plus','Jackery','explorer 1000 plus'],
  ['TP-Link Archer AX55','TP-Link','archer ax55'],['AVM FRITZ!Box 7590 AX','AVM','7590 ax'],
  ['Ubiquiti UniFi Dream Machine Pro','Ubiquiti','dream machine pro'],['Synology DiskStation DS923+','Synology','ds923'],
  ['Samsung Portable SSD T7 Shield 2TB','Samsung','t7 shield'],['SanDisk Extreme Portable SSD V2 2TB','SanDisk','extreme portable ssd v2'],
  ['BenQ PD3225U','BenQ','pd3225u'],['Dell UltraSharp U2723QE','Dell','u2723qe'],
  ['LG UltraGear 27GR95QE-B','LG','27gr95qe'],['Epson EcoTank ET-4850','Epson','et-4850'],
  ['Brother MFC-L3770CDW','Brother','mfc-l3770cdw'],['HP OfficeJet Pro 9022e','HP','9022e'],
  ['Cybex Sirona Gi i-Size','Cybex','sirona gi'],['Thule Urban Glide 3','Thule','urban glide 3'],
  ['LEGO Technic Mercedes-AMG F1 W14 E Performance 42171','LEGO','42171'],['Toniebox Starterset Rot','tonies','toniebox starterset'],
  ['PetSafe ScoopFree SmartSpin','PetSafe','scoopfree smartspin'],['Furbo 360° Dog Camera','Furbo','360 dog camera'],
] as const;

const researchedSchema = z.object({
  canonicalName: z.string().trim().min(2).max(180), brand: z.string().trim().min(1).max(80),
  categorySlug: z.string().trim().nullable().optional(), description: z.string().trim().min(20).max(500),
  specs: z.array(z.object({ label: z.string().trim().min(1).max(50), value: z.string().trim().min(1).max(120) })).min(4).max(10),
  productUrl: z.string().url(), imageUrl: z.string().url().nullable().optional(), found: z.literal(true),
});

type Engine = 'brave' | 'perplexity';
type EngineResult = { engine:Engine; canonicalName?:string; brand?:string; categorySlug?:string|null; description?:string; specs?:Array<{label:string;value:string}>; productUrl?:string; imageUrl?:string|null; citations:string[]; latencyMs:number; tokens:number; costUsd:number; passed:boolean; score:number; reason?:string };
type Result = { query:string; expectedBrand:string; required:string; brave:EngineResult; perplexity:EngineResult; winner:Engine|null; selected:EngineResult|null; productId?:string; imageStoredVia?:string|null };

async function main(): Promise<void> {
  const apply = process.argv.includes('--apply');
  const fromReport = process.argv.includes('--from-report');
  const key = process.env.OPENROUTER_API_KEY?.trim();
  if (!key) throw new Error('OPENROUTER_API_KEY is required');
  const braveKey = process.env.BRAVE_SEARCH_KEY?.trim();
  if (!braveKey) throw new Error('BRAVE_SEARCH_KEY is required for the A/B comparison');
  const prisma = new PrismaClient();
  const categories = await prisma.category.findMany({ select: { slug: true } });
  const model=process.env.OPENROUTER_MODEL || 'google/gemini-3.1-flash-lite';
  const perplexityClient = new OpenRouterClient({ apiKey:key, model, appTitle:'Wudly Catalog Rebuild', webSearchEngine:'perplexity', webSearchMaxResults:8 });
  const offlineClient = new OpenRouterClient({ apiKey:key, model, appTitle:'Wudly Catalog Rebuild' });
  const brave = new BraveSearchService(braveKey);
  const results: Result[] = fromReport
    ? JSON.parse(readFileSync(resolve('tmp/catalog-researched.json'),'utf8')) as Result[]
    : [];
  for (let i=fromReport ? candidates.length : 0;i<candidates.length;i++) {
    const [query, expectedBrand, required] = candidates[i]!;
    const messages:ChatMessage[]=[{role:'system',content:`Recherchiere exakt dieses reale Konsumprodukt. Nutze nur belegte Webquellen. categorySlug muss einer dieser Werte oder null sein: ${categories.map(c=>c.slug).join(', ')}. Antworte nur JSON: {"canonicalName":string,"brand":string,"categorySlug":string|null,"description":string,"specs":[{"label":string,"value":string}],"productUrl":string,"imageUrl":string|null,"found":true}. Mindestens 4 sichere Specs; Herstellerseite als productUrl bevorzugen.`},{role:'user',content:`Produkt: ${query}`}];
    const [braveResult,perplexityResult]=await Promise.all([
      researchWithBrave(query,expectedBrand,required,messages,brave,offlineClient),
      researchWithPerplexity(query,expectedBrand,required,messages,perplexityClient),
    ]);
    const winner=pickWinner(braveResult,perplexityResult);
    results.push({query,expectedBrand,required,brave:braveResult,perplexity:perplexityResult,winner:winner?.engine??null,selected:winner});
    console.warn(`[${i+1}/${candidates.length}] ${query}: brave=${braveResult.passed?'PASS':'FAIL'}(${braveResult.score}) perplexity=${perplexityResult.passed?'PASS':'FAIL'}(${perplexityResult.score}) winner=${winner?.engine??'NONE'}`);
  }
  if(!fromReport) writeReports(results, 'researched');
  const passed=results.filter(r=>r.selected?.passed);
  console.warn(`Research complete: ${passed.length}/${results.length} passed.`);
  if(!apply){ console.warn('DRY RUN: use -- --apply to replace the catalog.'); await prisma.$disconnect(); return; }
  if(passed.length<90) throw new Error(`Safety stop: only ${passed.length}/100 products passed; catalog was NOT deleted.`);
  const before=await counts(prisma); writeFileSync(resolve('tmp/catalog-before-delete.json'),JSON.stringify(before,null,2));
  await prisma.$transaction([prisma.notification.updateMany({data:{productId:null,questionId:null}}),prisma.product.deleteMany({})]);
  const config = new ConfigService(process.env);
  const images = new ProductImageService(prisma as never, config as never);
  const appPrisma = prisma;
  const categoryMap=new Map((await appPrisma.category.findMany({select:{id:true,slug:true}})).map(c=>[c.slug,c.id]));
  for(let i=0;i<passed.length;i++){
    const r=passed[i]!; const selected=r.selected!;
    const product=await appPrisma.product.create({data:{canonicalName:selected.canonicalName!,normalizedName:normalizeProductName(selected.canonicalName!),brand:selected.brand!,categoryId:selected.categorySlug?categoryMap.get(selected.categorySlug)??null:null,description:selected.description!,specs:selected.specs as unknown as Prisma.InputJsonValue,status:'ACTIVE',sources:{create:{sourceType:'MANUFACTURER',sourceUrl:selected.productUrl,rawTitle:selected.canonicalName,matchConfidence:1}}}});
    r.productId=product.id;
    const report=await images.hunt(product.id,`${selected.brand} ${selected.canonicalName} offizielles Produktbild`,{candidateUrls:[selected.imageUrl],pageUrl:selected.productUrl});
    r.imageStoredVia=report.storedVia;
    console.warn(`[import ${i+1}/${passed.length}] ${selected.canonicalName}: source=${r.winner} image=${report.storedVia??'NONE'}`);
  }
  writeReports(results,'imported');
  await prisma.$disconnect();
}

async function counts(prisma:PrismaClient){return {products:await prisma.product.count(),ownerships:await prisma.ownership.count(),experiences:await prisma.experienceReport.count(),questions:await prisma.productQuestion.count(),answers:await prisma.productAnswer.count(),showcases:await prisma.productShowcase.count(),images:await prisma.productImage.count()};}
async function researchWithBrave(query:string,expectedBrand:string,required:string,messages:ChatMessage[],brave:BraveSearchService,client:OpenRouterClient):Promise<EngineResult>{const started=Date.now();const context=await brave.context(`${query} offizielle Produktseite technische Daten`,8);if(!context)return failed('brave',started,'no-search-results');const response=await client.completeJsonDetailed([{role:'system',content:`Aktuelle Brave-Ergebnisse. Nutze ausschliesslich diese Quellen:\n\n${context}`},...messages],{temperature:0.1,maxTokens:800,timeoutMs:45000});return evaluate('brave',expectedBrand,required,response,started,0.005);}
async function researchWithPerplexity(_query:string,expectedBrand:string,required:string,messages:ChatMessage[],client:OpenRouterClient):Promise<EngineResult>{const started=Date.now();const response=await client.completeJsonDetailed(messages,{online:true,temperature:0.1,maxTokens:800,timeoutMs:45000});return evaluate('perplexity',expectedBrand,required,response,started,0.005);}
function evaluate(engine:Engine,expectedBrand:string,required:string,response:Awaited<ReturnType<OpenRouterClient['completeJsonDetailed']>>,started:number,searchCost:number):EngineResult{const parsed=researchedSchema.safeParse(parseJsonObject(response.content??null));if(!response.ok||!parsed.success)return failed(engine,started,response.error??'invalid-json');const data=parsed.data;const normalizedName=normalizeProductName(data.canonicalName);const brandCorrect=normalizeProductName(data.brand).includes(normalizeProductName(expectedBrand));const modelCorrect=required.split(' ').every(t=>normalizedName.includes(normalizeProductName(t)));const manufacturerUrl=isLikelyManufacturer(data.productUrl,data.brand);const citations=response.citations.length;const score=(brandCorrect?30:0)+(modelCorrect?35:0)+Math.min(data.specs.length,8)*2+(manufacturerUrl?10:0)+Math.min(citations,8);const passed=brandCorrect&&modelCorrect&&data.specs.length>=4&&Boolean(data.productUrl);return {engine,...data,citations:response.citations,latencyMs:Date.now()-started,tokens:response.usage?.totalTokens??0,costUsd:response.usage?.costUsd??searchCost,passed,score,reason:passed?undefined:!brandCorrect?'brand-mismatch':!modelCorrect?'model-mismatch':'insufficient-data'};}
function failed(engine:Engine,started:number,reason:string):EngineResult{return {engine,citations:[],latencyMs:Date.now()-started,tokens:0,costUsd:0,passed:false,score:0,reason};}
function pickWinner(brave:EngineResult,perplexity:EngineResult):EngineResult|null{const valid=[brave,perplexity].filter(r=>r.passed);if(valid.length===0)return null;valid.sort((a,b)=>b.score-a.score||a.costUsd-b.costUsd||a.latencyMs-b.latencyMs);return valid[0]!;}
function isLikelyManufacturer(url:string,brand:string):boolean{try{const host=new URL(url).hostname.toLowerCase().replace(/^www\./,'');const token=normalizeProductName(brand).replace(/\s+/g,'');return host.replace(/[^a-z0-9]/g,'').includes(token);}catch{return false;}}
function writeReports(results:Result[],phase:string){mkdirSync(resolve('tmp'),{recursive:true});writeFileSync(resolve(`tmp/catalog-${phase}.json`),JSON.stringify(results,null,2));const selected=results.filter(r=>r.selected);const braveWins=results.filter(r=>r.winner==='brave').length;const perplexityWins=results.filter(r=>r.winner==='perplexity').length;const lines=['# Wudly A/B-Produktrecherche','',`Stand: ${new Date().toISOString()}`,'',`Importfaehig: ${selected.length}/${results.length}; Brave-Siege: ${braveWins}; Perplexity-Siege: ${perplexityWins}`,'','| # | Anfrage | Brave | Perplexity | Gewinner | Produkt | Specs | Bild |','|---:|---|---:|---:|---|---|---:|---|',...results.map((r,i)=>`| ${i+1} | ${r.query} | ${r.brave.passed?'PASS':'FAIL'} ${r.brave.score} | ${r.perplexity.passed?'PASS':'FAIL'} ${r.perplexity.score} | ${r.winner??'-'} | ${r.selected?.canonicalName??'-'} | ${r.selected?.specs?.length??0} | ${r.imageStoredVia??'-'} |`)];writeFileSync(resolve(`tmp/catalog-${phase}.md`),lines.join('\n'));}

main().catch(e=>{console.error(e);process.exitCode=1;});
