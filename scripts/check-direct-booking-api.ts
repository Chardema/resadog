/* eslint-disable @typescript-eslint/no-explicit-any -- In-memory Prisma double for isolated handler execution. */
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { createRequire } from "node:module";
import ts from "typescript";
import { addCalendarDays, getTodayDateKey } from "../src/lib/booking-dates";
const requireReal = createRequire(import.meta.url);
type Row = Record<string, any>; // Test database accepts the actual Prisma handler shapes.
let role: string | null = "ADMIN";
let bookings: Row[] = [], users: Row[] = [], pets: Row[] = [], unavailable = false;
let nextId = 0;
const tx = {
  $executeRaw: async () => 1, $queryRaw: async () => [],
  user: { findUnique: async ({ where }: Row) => users.find(u => where.id ? u.id === where.id : u.email === where.email) || null, create: async ({ data }: Row) => { const row = { id: `user${++nextId}`, ...data }; users.push(row); return row; } },
  pet: { findMany: async ({ where }: Row) => pets.filter(p => where.id.in.includes(p.id) && p.ownerId === where.ownerId), create: async ({ data }: Row) => { const row = { id: `pet${++nextId}`, ...data }; pets.push(row); return row; } },
  availability: { findMany: async () => unavailable ? [{ date: new Date(`${date}T12:00:00Z`), available: false, maxSlots: 0 }] : [] },
  booking: {
    findUnique: async ({ where }: Row) => bookings.find(b => b.id === where.id) || null,
    findMany: async ({ where }: Row) => bookings.filter(b => b.id !== where.id.not && where.status.in.includes(b.status) && b.serviceType === where.serviceType && b.startDate <= where.startDate.lte && b.endDate >= where.endDate.gte),
    create: async ({ data }: Row) => { const row = { ...data, createdAt: new Date(), payment: { id: `pay${++nextId}`, ...data.payment.create } }; bookings.push(row); return row; },
    update: async ({ where, data }: Row) => Object.assign(bookings.find(b => b.id === where.id)!, data),
  },
  payment: { update: async ({ where, data }: Row) => Object.assign(bookings.find(b => b.payment.id === where.id)!.payment, data) },
};
const prisma = { ...tx, $transaction: async (run: (transaction: typeof tx) => Promise<unknown>) => {
  const original = structuredClone({ bookings, users, pets });
  try { return await run(tx); } catch (error) { ({ bookings, users, pets } = original); throw error; }
} };
const mocks: Record<string, unknown> = { "@/lib/auth": { auth: async () => role ? { user: { id: "admin-test", role } } : null }, "@/lib/db/prisma": { prisma } };
const cache: Record<string, unknown> = {};
function load(name: string): any {
  if (name in mocks) return mocks[name];
  if (!name.startsWith("@/")) return requireReal(name);
  if (name in cache) return cache[name];
  const file = `src/${name.slice(2)}.ts`;
  const code = ts.transpileModule(fs.readFileSync(file, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const exports = {}; cache[name] = exports;
  vm.runInNewContext(code, { exports, require: load, console, Date, process, URL, Set, Map }); return exports;
}
const { POST } = load("@/app/api/admin/bookings/direct/route");
const { PATCH } = load("@/app/api/admin/bookings/direct/[bookingId]/route");
const date = addCalendarDays(getTodayDateKey(), 35);
const body = { requestId: "bff3cbf5-5c51-4b68-840c-63dc5d7f536a", client: { name: "Client Test", email: "test@example.com", phone: "0700000000" }, pet: { name: "Milo", species: "DOG", birthDate: "2014-09-06" }, serviceType: "BOARDING", startDate: date, endDate: date, startTime: "08:00", endTime: "23:00", agreementEvidence: "Accord SMS sur devis et CGV", paymentMethod: "DIRECT_CASH", paid: false, expectedTotal: 45 };
const post = (input: Row = body) => POST({ json: async () => input });
async function main() {
  role = null; assert.equal((await post()).status, 403);
  role = "CLIENT"; assert.equal((await post()).status, 403);
  role = "ADMIN";
  assert.equal((await post({ ...body, expectedTotal: 1 })).status, 400); assert.equal(bookings.length, 0); assert.equal(users.length, 0, "invalid price rolls back client and pet");
  unavailable = true; assert.equal((await post()).status, 409); assert.equal(users.length, 0, "blocked date rolls back"); unavailable = false;
  const created = await post(); assert.equal(created.status, 200, JSON.stringify(await created.clone().json()));
  assert.equal(bookings.length, 1); assert.equal(bookings[0].totalPrice, 45); assert.equal(bookings[0].payment.status, "PENDING"); assert.equal(bookings[0].payment.capturedAmount, 0); assert.equal(bookings[0].status, "CONFIRMED"); assert.equal(users[0].passwordHash, undefined); assert.equal(bookings[0].payment.stripePaymentId, undefined);
  assert.equal((await post()).status, 200); assert.equal(bookings.length, 1, "retry creates no duplicate");
  assert.equal((await post({ ...body, requestId: "bff3cbf5-5c51-4b68-840c-63dc5d7f536b", client: { ...body.client, email: "second@example.com" } })).status, 409, "existing booking consumes capacity");
  const id = bookings[0].id;
  const patch = (input: Row) => PATCH({ json: async () => input }, { params: Promise.resolve({ bookingId: id }) });
  role = "CLIENT"; assert.equal((await patch({ action: "PAID", reference: "cash receipt", date: getTodayDateKey() })).status, 403); role = "ADMIN";
  assert.equal((await patch({ action: "PAID", reference: "cash receipt", date: getTodayDateKey() })).status, 200);
  assert.equal(bookings[0].payment.capturedAmount, 45);
  assert.equal((await patch({ action: "PAID", reference: "cash receipt", date: getTodayDateKey() })).status, 200);
  assert.equal((await patch({ action: "CANCEL", reference: "client cancelled", date: getTodayDateKey() })).status, 409, "paid cancellation needs real refund acknowledgement");
  assert.equal(bookings[0].status, "CONFIRMED");
  assert.equal((await patch({ action: "CANCEL", reference: "full cash refund", date: getTodayDateKey(), refunded: true })).status, 200);
  assert.equal(bookings[0].payment.status, "REFUNDED"); assert.equal(bookings[0].payment.refundAmount, 45); assert.equal(bookings[0].status, "CANCELLED");
  console.log("OK — real direct API and capacity gate: authorization, server price, transaction rollback, blocked/full capacity, idempotence, receipts, refunds. In-memory DB; no external writes/messages/payments.");
}
void main();
