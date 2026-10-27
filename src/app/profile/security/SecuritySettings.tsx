"use client";

import { useEffect, useState } from "react";
import { signOut } from "next-auth/react";
import Image from "next/image";
import { Copy, KeyRound, RefreshCcw, ShieldCheck, ShieldOff } from "lucide-react";

type SecurityStatus = {
  enabled: boolean;
  recoveryCodesRemaining: number;
  methods: string[];
};

export function SecuritySettings() {
  const [status, setStatus] = useState<SecurityStatus | null>(null);
  const [setup, setSetup] = useState<{ secret: string; qrCode: string } | null>(null);
  const [code, setCode] = useState("");
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const loadStatus = async () => {
    const response = await fetch("/api/auth/2fa/status", { cache: "no-store" });
    if (response.ok) setStatus(await response.json());
  };

  useEffect(() => {
    loadStatus().catch(() => setError("Impossible de charger les réglages de sécurité."));
  }, []);

  const request = async (url: string, method: string, body?: unknown) => {
    setLoading(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch(url, {
        method,
        headers: body ? { "Content-Type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Opération impossible.");
      return data;
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Opération impossible.");
      return null;
    } finally {
      setLoading(false);
    }
  };

  const beginSetup = async () => {
    const data = await request("/api/auth/2fa/setup", "GET");
    if (data) {
      setSetup(data);
      setRecoveryCodes([]);
      setCode("");
    }
  };

  const confirmSetup = async () => {
    const data = await request("/api/auth/2fa/setup", "POST", { code });
    if (data) {
      setRecoveryCodes(data.recoveryCodes);
      setSetup(null);
      setCode("");
      setMessage("Double authentification activée.");
      await loadStatus();
    }
  };

  const regenerate = async () => {
    const data = await request("/api/auth/2fa/recovery-codes", "POST", { code });
    if (data) {
      setRecoveryCodes(data.recoveryCodes);
      setCode("");
      setMessage("Les anciens codes ont été invalidés.");
      await loadStatus();
    }
  };

  const disable = async () => {
    const data = await request("/api/auth/2fa/setup", "DELETE", { code });
    if (data) await signOut({ callbackUrl: "/auth/signin" });
  };

  if (!status) {
    return <div className="h-40 animate-pulse rounded-2xl bg-gray-100" />;
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex items-start gap-4">
          <div className={`rounded-xl p-3 ${status.enabled ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
            {status.enabled ? <ShieldCheck className="h-6 w-6" /> : <ShieldOff className="h-6 w-6" />}
          </div>
          <div className="flex-1">
            <h2 className="text-xl font-bold text-gray-950">Application d'authentification</h2>
            <p className="mt-1 text-sm leading-6 text-gray-600">
              {status.enabled
                ? `Protection active. ${status.recoveryCodesRemaining} code(s) de récupération restant(s).`
                : "Ajoutez un code temporaire après votre mot de passe ou votre connexion sociale."}
            </p>
          </div>
        </div>

        {!status.enabled && !setup && recoveryCodes.length === 0 && (
          <button onClick={beginSetup} disabled={loading} className="mt-6 h-12 rounded-xl bg-gray-950 px-5 font-bold text-white hover:bg-orange-600 disabled:opacity-50">
            Activer la double authentification
          </button>
        )}

        {setup && (
          <div className="mt-6 border-t border-gray-100 pt-6">
            <ol className="space-y-5 text-sm leading-6 text-gray-700">
              <li><strong>1.</strong> Scannez ce QR code avec 1Password, Google Authenticator, Authy ou votre gestionnaire de mots de passe.</li>
              <li className="flex justify-center">
                <Image
                  src={setup.qrCode}
                  alt="QR code de configuration 2FA"
                  width={256}
                  height={256}
                  unoptimized
                  className="h-64 w-64 rounded-xl border border-gray-200"
                />
              </li>
              <li>
                <strong>Clé manuelle :</strong>
                <code className="mt-2 block break-all rounded-lg bg-gray-100 p-3 font-mono">{setup.secret}</code>
              </li>
              <li><strong>2.</strong> Entrez le premier code généré pour confirmer.</li>
            </ol>
            <div className="mt-4 flex flex-col gap-3 sm:flex-row">
              <input value={code} onChange={(event) => setCode(event.target.value)} inputMode="numeric" autoComplete="one-time-code" placeholder="000000" className="h-12 flex-1 rounded-xl border border-gray-200 px-4 text-center font-mono tracking-[0.2em]" />
              <button onClick={confirmSetup} disabled={loading} className="h-12 rounded-xl bg-orange-600 px-5 font-bold text-white disabled:opacity-50">Confirmer</button>
            </div>
          </div>
        )}

        {status.enabled && recoveryCodes.length === 0 && (
          <div className="mt-6 border-t border-gray-100 pt-6">
            <label className="text-sm font-semibold text-gray-800" htmlFor="security-code">
              Code actuel ou code de récupération
            </label>
            <input id="security-code" value={code} onChange={(event) => setCode(event.target.value)} autoComplete="one-time-code" className="mt-2 h-12 w-full rounded-xl border border-gray-200 px-4 font-mono" placeholder="000000" />
            <div className="mt-3 flex flex-wrap gap-3">
              <button onClick={regenerate} disabled={loading || code.length < 6} className="inline-flex h-11 items-center gap-2 rounded-xl border border-gray-300 px-4 text-sm font-bold text-gray-800 hover:bg-gray-50 disabled:opacity-50">
                <RefreshCcw className="h-4 w-4" /> Renouveler les codes
              </button>
              <button onClick={disable} disabled={loading || code.length < 6} className="h-11 rounded-xl border border-red-200 px-4 text-sm font-bold text-red-700 hover:bg-red-50 disabled:opacity-50">
                Désactiver la 2FA
              </button>
            </div>
          </div>
        )}
      </section>

      {recoveryCodes.length > 0 && (
        <section className="rounded-2xl border-2 border-orange-300 bg-orange-50 p-6">
          <div className="flex items-center gap-3">
            <KeyRound className="h-6 w-6 text-orange-700" />
            <h2 className="text-xl font-bold text-gray-950">Enregistrez vos codes de récupération</h2>
          </div>
          <p className="mt-3 text-sm leading-6 text-gray-700">
            Chaque code ne fonctionne qu'une fois. Ils ne seront plus affichés après avoir quitté cette page.
          </p>
          <div className="mt-5 grid grid-cols-1 gap-2 sm:grid-cols-2">
            {recoveryCodes.map((recoveryCode) => (
              <code key={recoveryCode} className="rounded-lg border border-orange-200 bg-white p-3 text-center font-mono font-bold">
                {recoveryCode}
              </code>
            ))}
          </div>
          <button
            type="button"
            onClick={() => navigator.clipboard.writeText(recoveryCodes.join("\n"))}
            className="mt-4 inline-flex h-11 items-center gap-2 rounded-xl bg-gray-950 px-4 text-sm font-bold text-white"
          >
            <Copy className="h-4 w-4" /> Copier les codes
          </button>
        </section>
      )}

      {(message || error) && (
        <p className={`rounded-xl p-4 text-sm font-semibold ${error ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-800"}`}>
          {error || message}
        </p>
      )}

      <section className="rounded-2xl border border-gray-200 bg-white p-6">
        <h2 className="font-bold text-gray-950">Méthodes de connexion</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {status.methods.map((method) => (
            <span key={method} className="rounded-full bg-gray-100 px-3 py-1 text-sm font-semibold capitalize text-gray-700">
              {method === "password" ? "Email + mot de passe" : method}
            </span>
          ))}
        </div>
      </section>
    </div>
  );
}
