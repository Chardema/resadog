import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { buildGoogleReviewEmail } from "../src/lib/email";
import { GOOGLE_REVIEW_URL } from "../src/lib/google-reviews";
const mail = buildGoogleReviewEmail("Alex", "Moka");
assert.ok(mail.html.includes('lang="fr"'));
assert.ok(mail.html.includes('lang="en"'));
assert.equal(mail.html.split(`href="${GOOGLE_REVIEW_URL}"`).length - 1, 2);
assert.ok(mail.text.includes("I hope you enjoyed your experience"));
assert.ok(mail.text.includes("J’espère que vous avez apprécié"));
for (const content of [mail.html, mail.text]) {
  assert.equal(content.split("Mégane · La Patte Dorée 🐾").length - 1, 2);
  assert.ok(!content.includes("Christopher"));
}
const hostile = buildGoogleReviewEmail('<img src=x onerror="alert(1)">', '<script>alert(1)</script>');
assert.ok(!hostile.html.includes('<script>'));
assert.ok(!hostile.html.includes('<img src=x'));
assert.ok(hostile.html.includes('&lt;script&gt;'));
assert.deepEqual(buildGoogleReviewEmail("Alex", "Moka"), mail);
mkdirSync("output/google-review", { recursive: true });
writeFileSync("output/google-review/apercu-fr-en.html", mail.html);
console.log("Google review email: bilingual copy, direct Google buttons, escaping and deterministic rendering passed. No email sent.");

async function checkGrouping() {
  const { googleReviewGroupMessage, sendGoogleReviewForBookings } = await import("../src/lib/google-review-requests");
  const { validateCompletionSelection, groupNearbyBookings } = await import("../src/lib/booking-completion");
  const a = { id: "a", clientId: "client", client: { email: "client@example.com", name: "Alex" }, pets: [{ name: "Moka" }], status: "CONFIRMED", startDate: new Date("2026-09-01"), endDate: new Date("2026-09-03") };
  const b = { ...a, id: "b", pets: [{ name: "Moka" }, { name: "Plume" }], startDate: new Date("2026-09-05"), endDate: new Date("2026-09-06") };
  const later = { ...a, id: "later", startDate: new Date("2026-10-01"), endDate: new Date("2026-10-02") };
  const other = { ...b, id: "other", clientId: "other-client" };
  assert.deepEqual(validateCompletionSelection("a", ["a", "b"], [a,b]), ["a","b"]);
  assert.throws(() => validateCompletionSelection("a", ["a", "other"], [a,other]), /même client/);
  assert.throws(() => validateCompletionSelection("a", ["a", "b"], [a,{...b,status:"CANCELLED"}]), /ne peut plus/);
  assert.throws(() => validateCompletionSelection("a", ["a", "missing"], [a]), /invalide/);
  assert.throws(() => validateCompletionSelection("a", ["b"], [b]), /invalide/);
  assert.deepEqual(googleReviewGroupMessage([a,b]), googleReviewGroupMessage([b,a]));
  assert.equal(googleReviewGroupMessage([a,b]).petNames, "Moka, Plume");
  assert.equal(googleReviewGroupMessage([a,b]).email, "client@example.com");
  assert.throws(() => googleReviewGroupMessage([a,other]), /invalide/);
  const groups = groupNearbyBookings([later,other,b,a]);
  assert.equal(groups.length, 3);
  assert.ok(groups.some(group => group.length === 2 && group.some(item => item.id === "a") && group.some(item => item.id === "b")));
  type Log = { idempotencyKey: string; status: string; from: string; to: string[]; subject: string; createdAt: Date };
  const logs: Log[] = [];
  let sends = 0;
  const tx = {
    $executeRaw: async () => 1,
    booking: { findMany: async () => [{ id: "a" }, { id: "b" }] },
    emailLog: {
      findFirst: async (query: { where: { idempotencyKey: string | { in: string[] } } }) => logs.find(log => typeof query.where.idempotencyKey === "string" ? log.idempotencyKey === query.where.idempotencyKey : query.where.idempotencyKey.in.includes(log.idempotencyKey)) || null,
      findMany: async (query: { where: { idempotencyKey: { in: string[] } } }) => logs.filter(log => query.where.idempotencyKey.in.includes(log.idempotencyKey)),
      createMany: async ({ data }: { data: Log[] }) => { logs.push(...data); return { count: data.length }; },
    },
  };
  type Deps = NonNullable<Parameters<typeof sendGoogleReviewForBookings>[1]>;
  const db = { $transaction: async (fn: (value: typeof tx) => Promise<unknown>) => fn(tx) } as unknown as Deps["db"];
  const send: Deps["send"] = async (email, name, pets, key) => {
    sends++;
    assert.equal(email, "client@example.com"); assert.equal(pets, "Moka, Plume");
    logs.push({ idempotencyKey: key, status: "SENT", from: "test", to: [email], subject: "Google", createdAt: new Date() });
    return { id: "mock-provider" };
  };
  assert.deepEqual(await sendGoogleReviewForBookings([a,b], { db, send }), { alreadySent: false });
  assert.equal(sends, 1, "Two completed bookings send one email");
  assert.deepEqual(await sendGoogleReviewForBookings([b,a], { db, send }), { alreadySent: true });
  assert.deepEqual(await sendGoogleReviewForBookings([b], { db, send }), { alreadySent: true });
  assert.equal(sends, 1, "Group retry and individual retry must not resend");
  logs.length = 0;
  await assert.rejects(sendGoogleReviewForBookings([a,b], { db, send: async () => { throw new Error("provider failed"); } }), /provider failed/);
  assert.equal(logs.length, 0, "Failed delivery must not mark bookings as covered");
  assert.ok(!mail.html.includes("/avis/"));
  console.log("Grouped completion: same-client selection, invalid states, stable delivery key, deduplicated pets and 7-day grouping passed. No live delivery invoked.");
}
checkGrouping().catch(error => { console.error(error); process.exitCode = 1; });
