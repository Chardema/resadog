import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import ts from 'typescript';

// Execute the real POST handler with in-memory auth and database dependencies.
// No network, customer booking, email or payment is created by this check.
const load = createRequire(import.meta.url);
const realNow = Date.now();
const tomorrow = new Date(realNow + 12 * 3600_000);
const parts = Object.fromEntries(new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Paris', year:'numeric', month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit', hourCycle:'h23' }).formatToParts(tomorrow).map(p => [p.type,p.value]));
const date = `${parts.year}-${parts.month}-${parts.day}`;
const startTime = `${parts.hour}:${parts.minute}`;
const endDate = new Date(`${date}T12:00:00Z`); endDate.setUTCDate(endDate.getUTCDate()+3);
const pet = { id:'test-dog', name:'Test dog', species:'DOG', age:4, breed:'Test', birthDate:'2020-01-01', birthDateProofUrl:'https://example.com/proof', birthDateVerifiedAt:new Date(), weight:10, gender:'MALE', spayedNeutered:true, medicalInfo:'None', medications:'None', behaviorNotes:'Calm', feedingSchedule:'Morning', vetInfo:'Vet', emergencyContact:'Contact' };
let premium = false;
let saved: Record<string, unknown> | undefined;
const prisma = {
  pet: { findMany: async () => [pet] },
  userSubscription: { findUnique: async () => premium ? {status:'ACTIVE'} : null },
  availability: { findMany: async () => [] },
  booking: { findMany: async () => [], create: async ({data}: {data:Record<string, unknown>}) => { saved=data; return {...data,id:'test-booking',pets:[{name:pet.name}],client:{name:'Test'}}; } },
};
const mocks: Record<string, unknown> = {
  '@/lib/auth': {auth:async()=>({user:{id:'test-client'}})},
  '@/lib/db/prisma': {prisma},
  '@/lib/rate-limit': {distributedRateLimit:async()=>({success:true})},
};
const source = ts.transpileModule(fs.readFileSync('src/app/api/bookings/route.ts','utf8'), {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const exports: {POST?: (req: {json:()=>Promise<unknown>})=>Promise<Response>} = {};
vm.runInNewContext(source, {exports,require:(id:string)=>id in mocks ? mocks[id] : load(id.startsWith('@/') ? `../src/${id.slice(2)}` : id), console,Date,process,URL,Set,Map});
const body = {petIds:[pet.id],serviceType:'BOARDING',startDate:date,endDate:endDate.toISOString().slice(0,10),startTime,endTime:startTime,totalPrice:1,depositAmount:1,expectedLastMinuteFee:10};
async function main() {
  const post = exports.POST!;
  let response = await post({json:async()=>body});
  assert.equal(response.status,200,JSON.stringify(await response.clone().json()));
  assert.equal(saved?.totalPrice,145,'server ignores forged client total and adds one fee');
  assert.match(String(saved?.notes),/dernière minute 10.00 EUR inclus/,'invoice snapshot');
  saved=undefined;
  response=await post({json:async()=>({...body,expectedLastMinuteFee:0})});
  assert.equal(response.status,409,'changed or omitted fee requires new acknowledgement');
  assert.equal(saved,undefined,'no booking written on fee mismatch');
  premium=true;
  response=await post({json:async()=>body});
  assert.equal(response.status,200);
  assert.equal((saved as Record<string, unknown> | undefined)?.totalPrice,131.5,'Premium discounts service only');
  console.log('OK — real booking POST: server recalculation, fee acknowledgement, persisted pricing note, Premium. Database/auth mocked; no external effects.');
}
void main();
