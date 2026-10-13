"use client";

import { useEffect, useState } from "react";
import { signIn } from "next-auth/react";

type Provider = { id: string; name: string; type: string };

export function SocialAuthButtons() {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [loadingProvider, setLoadingProvider] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/auth/providers")
      .then((response) => (response.ok ? response.json() : {}))
      .then((data: Record<string, Provider>) => {
        setProviders(Object.values(data).filter((provider) => ["google", "apple"].includes(provider.id)));
      })
      .catch(() => setProviders([]));
  }, []);

  if (providers.length === 0) return null;

  return (
    <>
      <div className="my-6 flex items-center gap-3" aria-hidden="true">
        <span className="h-px flex-1 bg-gray-200" />
        <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">ou</span>
        <span className="h-px flex-1 bg-gray-200" />
      </div>
      <div className="grid gap-3">
        {providers.map((provider) => (
          <button
            key={provider.id}
            type="button"
            disabled={loadingProvider !== null}
            onClick={async () => {
              setLoadingProvider(provider.id);
              await signIn(provider.id, {
                callbackUrl: "/auth/two-factor?next=/dashboard",
              });
              setLoadingProvider(null);
            }}
            className="flex h-12 items-center justify-center gap-3 rounded-xl border border-gray-200 bg-white px-4 font-semibold text-gray-800 transition hover:border-gray-400 hover:bg-gray-50 disabled:opacity-50"
          >
            {provider.id === "google" ? (
              <span className="grid h-6 w-6 place-items-center rounded-full border text-sm font-bold text-blue-600">G</span>
            ) : (
              <span className="text-2xl leading-none" aria-hidden="true">●</span>
            )}
            {loadingProvider === provider.id
              ? "Redirection..."
              : `Continuer avec ${provider.id === "google" ? "Google" : "Apple"}`}
          </button>
        ))}
      </div>
    </>
  );
}
