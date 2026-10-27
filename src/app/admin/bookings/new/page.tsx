"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { calculateDirectPrice, directBookingSchema, DIRECT_METHODS } from "@/lib/direct-booking";
import { SERVICE_TYPES, getServiceLabel, type AppServiceType } from "@/lib/services";
import { getTodayDateKey } from "@/lib/booking-dates";

type Pet = { id: string; name: string; species: "DOG" | "CAT"; birthDate: string | null; age: number | null };
type Client = { id: string; name: string; email: string; phone: string | null; pets: Pet[] };
const field = "mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-950";
export default function NewDirectBookingPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [clientId, setClientId] = useState("");
  const [petIds, setPetIds] = useState<string[]>([]);
  const [newPet, setNewPet] = useState(true);
  const [service, setService] = useState<AppServiceType>("BOARDING");
  const [startDate, setStartDate] = useState(getTodayDateKey);
  const [endDate, setEndDate] = useState(getTodayDateKey);
  const [startTime, setStartTime] = useState("08:00");
  const [endTime, setEndTime] = useState("18:00");
  const [species, setSpecies] = useState<"DOG" | "CAT">("DOG");
  const [birthDate, setBirthDate] = useState("");
  const [paid, setPaid] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [requestId, setRequestId] = useState("");
  useEffect(() => {
    if (session?.user?.role !== "ADMIN") return;
    let active = true;
    fetch("/api/admin/bookings/direct").then(async response => {
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Chargement impossible.");
      if (active) { setClients(data.clients); setRequestId(crypto.randomUUID()); }
    }).catch(error => { if (active) setError(error.message); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [session?.user?.role]);
  const client = clients.find(c => c.id === clientId);
  const pets = newPet ? [{ id: "new", species, birthDate }] : client?.pets.filter(p => petIds.includes(p.id)) || [];
  let total = 0, lastMinuteFee = 0, priceError = "";
  try {
    if (pets.length && (!newPet || birthDate) && startDate && endDate) {
      if (new Date(endDate).getTime() - new Date(startDate).getTime() > 90 * 86400000) throw new Error("La garde est limitée à 90 jours.");
      const price = calculateDirectPrice({ serviceType: service, startDate, endDate, startTime, endTime }, pets);
      total = price.total; lastMinuteFee = price.lastMinuteFee;
    }
  } catch (error) { priceError = error instanceof Error ? error.message : "Tarif indisponible."; }
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (busy) return;
    setError("");
    const form = new FormData(event.currentTarget);
    const text = (key: string) => String(form.get(key) || "");
    const input = { requestId, ...(clientId ? { clientId } : { client: { name: text("clientName"), email: text("email"), phone: text("phone") } }),
      ...(newPet ? { pet: { name: text("petName"), species, birthDate, notes: text("petNotes") } } : { petIds }),
      serviceType: service, startDate, endDate, startTime, endTime, serviceAddress: text("address"), notes: text("notes"), agreementEvidence: text("agreement"),
      paymentMethod: text("paymentMethod"), paid, ...(paid ? { paidOn: text("paidOn") } : {}), paymentReference: text("reference"), expectedTotal: total,
    };
    const parsed = directBookingSchema.safeParse(input);
    if (!parsed.success) { setError(parsed.error.issues[0].message); return; }
    setBusy(true);
    try {
      const response = await fetch("/api/admin/bookings/direct", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(parsed.data) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Enregistrement impossible.");
      router.push("/admin/bookings?directCreated=1");
    } catch (error) { setError(error instanceof Error ? error.message : "Enregistrement impossible."); setBusy(false); }
  }
  if (status === "loading") return <p>Chargement…</p>;
  if (session?.user?.role !== "ADMIN") return <p>Accès réservé à l’administration.</p>;
  return <div className="mx-auto max-w-3xl" data-no-translate>
    <Link href="/admin/bookings" className="text-sm text-orange-700 underline">← Réservations</Link>
    <h1 className="mt-4 text-3xl font-bold">Enregistrer une réservation directe</h1>
    <p className="mt-2 text-gray-600">Pour un accord par téléphone, SMS ou e-mail. Le client n’a pas besoin de créer un compte. La garde apparaît dans votre planning après enregistrement.</p>
    <form onSubmit={submit} className="mt-6 space-y-6">
      <fieldset disabled={busy || loading} className="space-y-6 disabled:opacity-60">
        <section className="space-y-4 rounded-xl border bg-white p-5"><h2 className="text-lg font-bold">1. Client et animal</h2>
          <label className="block text-sm font-medium">Client<select className={field} value={clientId} onChange={e => { setClientId(e.target.value); setPetIds([]); setNewPet(!e.target.value || !clients.find(c => c.id === e.target.value)?.pets.length); }}><option value="">Nouveau client</option>{clients.map(c => <option key={c.id} value={c.id}>{c.name || c.email} · {c.email}</option>)}</select></label>
          {!clientId && <div className="grid gap-4 sm:grid-cols-2"><label className="text-sm">Nom et prénom<input name="clientName" autoComplete="name" required className={field}/></label><label className="text-sm">Téléphone<input name="phone" type="tel" autoComplete="tel" required className={field}/></label><label className="text-sm sm:col-span-2">E-mail du client<input name="email" type="email" autoComplete="email" required className={field}/><span className="text-xs text-gray-500">Une fiche client sera créée, sans mot de passe ni e-mail automatique.</span></label></div>}
          {client && <><label className="flex gap-2 text-sm"><input type="checkbox" checked={newPet} onChange={e => setNewPet(e.target.checked)}/>Ajouter un nouvel animal</label>{!newPet && client.pets.map(p => <label key={p.id} className="flex gap-2 rounded-lg border p-3 text-sm"><input type="checkbox" checked={petIds.includes(p.id)} onChange={e => setPetIds(ids => e.target.checked ? [...ids, p.id] : ids.filter(id => id !== p.id))}/>{p.name}</label>)}</>}
          {newPet && <div className="grid gap-4 sm:grid-cols-2"><label className="text-sm">Nom de l’animal<input name="petName" required className={field}/></label><label className="text-sm">Espèce<select className={field} value={species} onChange={e => setSpecies(e.target.value as "DOG" | "CAT")}><option value="DOG">Chien</option><option value="CAT">Chat</option></select></label><label className="text-sm">Date de naissance<input type="date" required max={getTodayDateKey()} value={birthDate} onChange={e => setBirthDate(e.target.value)} className={field}/></label><label className="text-sm sm:col-span-2">Santé et besoins particuliers<textarea name="petNotes" className={field} placeholder="Traitements, habitudes, informations utiles…"/></label></div>}
        </section>
        <section className="space-y-4 rounded-xl border bg-white p-5"><h2 className="text-lg font-bold">2. Prestation et horaires</h2>
          <label className="block text-sm">Prestation<select value={service} onChange={e => setService(e.target.value as AppServiceType)} className={field}>{SERVICE_TYPES.map(s => <option key={s} value={s}>{getServiceLabel(s)}</option>)}</select></label>
          <p className="text-xs text-gray-500">Garderie : jusqu’à 10 h par jour. Pour une garde plus longue chez Mégane, choisir Hébergement. Visites et promenades : un créneau de 30 à 120 minutes.</p>
          <div className="grid gap-4 sm:grid-cols-2"><label className="text-sm">Date d’arrivée<input type="date" required min={getTodayDateKey()} value={startDate} onChange={e => { setStartDate(e.target.value); if (e.target.value > endDate) setEndDate(e.target.value); }} className={field}/></label><label className="text-sm">Date de départ<input type="date" required min={startDate} value={endDate} onChange={e => setEndDate(e.target.value)} className={field}/></label><label className="text-sm">Heure d’arrivée<input type="time" required value={startTime} onChange={e => setStartTime(e.target.value)} className={field}/></label><label className="text-sm">Heure de départ<input type="time" required value={endTime} onChange={e => setEndTime(e.target.value)} className={field}/></label></div>
          {["HOUSE_SITTING", "DROP_IN", "DOG_WALKING"].includes(service) && <label className="block text-sm">Adresse de la prestation<input name="address" required className={field}/></label>}
          <label className="block text-sm">Précisions sur la garde<textarea name="notes" className={field}/></label>
        </section>
        <section className="space-y-4 rounded-xl border bg-white p-5"><h2 className="text-lg font-bold">3. Tarif et paiement</h2>
          <div className="rounded-lg bg-orange-50 p-4"><p className="text-2xl font-bold text-orange-900">{total > 0 ? `${total.toFixed(2)} €` : "Renseignez l’animal et les horaires"}</p><p className="mt-1 text-xs text-gray-600">Tarif de la grille, hors code promotionnel et avantage Premium. {lastMinuteFee > 0 && `Supplément dernière minute de ${lastMinuteFee} € inclus.`} Le tarif et les disponibilités sont vérifiés à l’enregistrement.</p></div>
          <label className="block text-sm">Mode de paiement convenu<select name="paymentMethod" className={field}>{Object.entries(DIRECT_METHODS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
          <label className="flex gap-2 text-sm"><input type="checkbox" checked={paid} onChange={e => setPaid(e.target.checked)}/>J’ai déjà reçu la totalité du paiement</label>
          {paid ? <div className="grid gap-4 sm:grid-cols-2"><label className="text-sm">Date réelle de réception<input type="date" name="paidOn" required max={getTodayDateKey()} defaultValue={getTodayDateKey()} className={field}/></label><label className="text-sm">Référence ou justificatif<input name="reference" required className={field} placeholder="Référence du virement ou reçu espèces"/></label></div> : <p className="text-sm text-gray-500">Le paiement sera marqué « à recevoir ». Vous pourrez enregistrer l’encaissement plus tard.</p>}
          <label className="block text-sm">Trace de l’accord du client<textarea name="agreement" required minLength={10} className={field} placeholder="Date et support de l’accord sur le devis, les horaires et les CGV transmis au client…"/></label>
          <label className="flex items-start gap-2 text-sm"><input type="checkbox" required className="mt-1"/>J’ai vérifié les conditions d’accueil et obtenu l’accord du client sur le montant, les horaires et les CGV qui lui ont été transmis.</label>
        </section>
        <p className="text-sm text-gray-600">L’enregistrement confirme la garde dans le planning. Il n’envoie aucun message et ne déclenche aucun paiement. Confirmez ensuite les détails au client par le moyen convenu.</p>
        {(error || priceError) && <p role="alert" className="rounded-lg bg-red-50 p-4 text-red-800">{error || priceError}</p>}
        <button type="submit" disabled={busy || loading || !requestId || total <= 0 || !!priceError} className="rounded-lg bg-orange-700 px-5 py-3 font-bold text-white disabled:opacity-50">{busy ? "Enregistrement…" : "Confirmer et enregistrer la réservation"}</button>
      </fieldset>
      {loading && <p role="status">Chargement des clients…</p>}
      {!loading && !requestId && error && <p role="alert" className="text-red-800">{error} Rechargez la page pour réessayer.</p>}
    </form>
  </div>;
}
