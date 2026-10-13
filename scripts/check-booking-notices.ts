import "dotenv/config";
import assert from "node:assert/strict";
import { deliverBookingNotice } from "../src/lib/booking-notices";
import { prisma } from "../src/lib/db/prisma";
import { sendBookingNoticeEmail } from "../src/lib/email";

async function main() {
const now = new Date("2026-09-12T06:30:00Z");
function fixture(overrides = {}) {
  const row = { id:"notice-example", bookingId:"booking-example", kind:"NO_SHOW", to:"example@example.com", subject:"Subject", text:"Frozen original content", state:"PENDING", firstAttemptAt:null as Date|null, lockedUntil:null as Date|null, sentAt:null as Date|null, expiresAt:null as Date|null, booking:{status:"CANCELLED"}, ...overrides };
  let sends=0;
  const db = { bookingNotice: {
    findUniqueOrThrow: async () => ({...row}),
    updateMany: async ({data,where}: {data:object;where:{state?:{in:string[]}}}) => {
      if (where.state && !where.state.in.includes(row.state)) return {count:0};
      if (row.lockedUntil && row.lockedUntil > now) return {count:0};
      Object.assign(row,data); return {count:1};
    },
    update: async ({data}: {data:object}) => {Object.assign(row,data); return row;},
  }} as unknown as typeof prisma;
  const send = (async (notice: {text:string}) => {assert.equal(notice.text,"Frozen original content");sends++;await new Promise(r => setTimeout(r,5));return {id:"provider-id"};}) as typeof sendBookingNoticeEmail;
  return {row,db,send,sends:()=>sends};
}
const f=fixture();
await Promise.all([deliverBookingNotice(f.row.id,{db:f.db,send:f.send,now}),deliverBookingNotice(f.row.id,{db:f.db,send:f.send,now})]);
assert.equal(f.sends(),1);
assert.equal((await deliverBookingNotice(f.row.id,{db:f.db,send:f.send,now:new Date("2026-09-15T06:30:00Z")})).sent,true);
assert.equal(f.sends(),1);
const expired=fixture({kind:"REMINDER",booking:{status:"CONFIRMED"},expiresAt:new Date("2026-09-12T06:00:00Z")});
assert.equal((await deliverBookingNotice(expired.row.id,{...expired,now})).skipped,true);assert.equal(expired.sends(),0);
const cancelled=fixture({kind:"REMINDER"});
assert.equal((await deliverBookingNotice(cancelled.row.id,{...cancelled,now})).skipped,true);assert.equal(cancelled.sends(),0);
const uncertain=fixture({state:"SENDING",firstAttemptAt:new Date("2026-09-10T06:30:00Z")});
assert.equal((await deliverBookingNotice(uncertain.row.id,{...uncertain,now})).sent,false);assert.equal(uncertain.sends(),0);
const retry=fixture();
await deliverBookingNotice(retry.row.id,{...retry,now,send:async()=>{throw new Error("Temporary provider failure")}});
assert.equal(retry.row.state,"FAILED");
assert.equal((await deliverBookingNotice(retry.row.id,{...retry,now})).sent,true);assert.equal(retry.sends(),1);
console.log("Booking outbox: concurrent sends, durable deduplication, frozen content, expired/cancelled reminders, failed retry and old uncertain send guards passed. No real email sent.");
}
main().catch(e=>{console.error(e);process.exitCode=1});
