"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Check, Mail, Pencil, Phone, UserRound, X } from "lucide-react";
import { AppNav } from "@/components/layout/AppNav";
import { SubscriptionManager } from "@/components/subscription/SubscriptionManager";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type ProfileForm = {
  name: string;
  email: string;
  phone: string;
  image: string;
};

const emptyProfile: ProfileForm = { name: "", email: "", phone: "", image: "" };

export default function ProfilePage() {
  const { data: session, status, update } = useSession();
  const router = useRouter();
  const [isSaving, setIsSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [message, setMessage] = useState("");
  const [savedProfile, setSavedProfile] = useState<ProfileForm>(emptyProfile);
  const [formData, setFormData] = useState<ProfileForm>(emptyProfile);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/auth/signin");
      return;
    }

    if (status !== "authenticated") return;

    const controller = new AbortController();
    const loadProfile = async () => {
      try {
        const response = await fetch("/api/user/profile", { signal: controller.signal });
        const result = await response.json();
        if (!response.ok) return;
        const profile = {
          name: result.user.name || "",
          email: result.user.email || "",
          phone: result.user.phone || "",
          image: result.user.image || "",
        };
        setSavedProfile(profile);
        setFormData(profile);
      } catch {
        if (!controller.signal.aborted) setMessage("Impossible de charger le profil.");
      }
    };

    loadProfile();
    return () => controller.abort();
  }, [status, router]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsSaving(true);
    setMessage("");

    try {
      const response = await fetch("/api/user/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.name,
          phone: formData.phone,
          image: formData.image || null,
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Impossible d'enregistrer le profil.");
      const profile = { ...formData, name: result.user.name };
      setSavedProfile(profile);
      setFormData(profile);
      await update({ name: result.user.name });
      setMessage("Informations enregistrées.");
      setIsEditing(false);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Erreur de connexion.");
    } finally {
      setIsSaving(false);
    }
  };

  if (status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-200 border-t-orange-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-24 md:pb-10">
      <AppNav userName={session?.user?.name} />

      <main className="mx-auto max-w-4xl px-4 pt-6 sm:px-6 md:pt-32">
        <header className="mb-6 flex items-center gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-orange-100 text-xl font-bold text-orange-700">
            {formData.name?.charAt(0).toUpperCase() || <UserRound className="h-6 w-6" />}
          </div>
          <div className="min-w-0">
            <h1 className="truncate text-2xl font-bold text-gray-950 sm:text-3xl">
              {formData.name || "Mon profil"}
            </h1>
            <p className="truncate text-sm text-gray-500">{formData.email}</p>
          </div>
        </header>

        <div className="space-y-5">
          <SubscriptionManager />

          <section className="rounded-lg border border-gray-200 bg-white">
            <div className="flex items-center justify-between gap-4 border-b border-gray-100 p-5 sm:p-6">
              <div>
                <p className="text-sm font-semibold text-gray-500">Compte</p>
                <h2 className="mt-1 text-xl font-bold text-gray-950">Mes informations</h2>
              </div>
              {!isEditing && (
                <Button type="button" variant="outline" onClick={() => setIsEditing(true)} className="h-10 border-gray-300">
                  <Pencil className="h-4 w-4" />
                  Modifier
                </Button>
              )}
            </div>

            <form onSubmit={handleSubmit} className="p-5 sm:p-6">
              {message && (
                <p role="status" className="mb-4 rounded-md bg-gray-50 p-3 text-sm font-medium text-gray-700">
                  {message}
                </p>
              )}

              <div className="grid gap-5 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="profile-name" className="flex items-center gap-2 text-gray-700">
                    <UserRound className="h-4 w-4" /> Nom complet
                  </Label>
                  <Input
                    id="profile-name"
                    value={formData.name}
                    onChange={(event) => setFormData({ ...formData, name: event.target.value })}
                    disabled={!isEditing}
                    className="h-12 rounded-md border-gray-300 bg-white disabled:bg-gray-50"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="profile-email" className="flex items-center gap-2 text-gray-700">
                    <Mail className="h-4 w-4" /> Email
                  </Label>
                  <Input
                    id="profile-email"
                    value={formData.email}
                    disabled
                    className="h-12 rounded-md border-gray-200 bg-gray-50 text-gray-500"
                  />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="profile-phone" className="flex items-center gap-2 text-gray-700">
                    <Phone className="h-4 w-4" /> Téléphone
                  </Label>
                  <Input
                    id="profile-phone"
                    type="tel"
                    value={formData.phone}
                    onChange={(event) => setFormData({ ...formData, phone: event.target.value })}
                    disabled={!isEditing}
                    placeholder="06 00 00 00 00"
                    className="h-12 rounded-md border-gray-300 bg-white disabled:bg-gray-50"
                  />
                </div>
              </div>

              {isEditing && (
                <div className="mt-6 grid grid-cols-2 gap-3 border-t border-gray-100 pt-5 sm:flex sm:justify-end">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setFormData(savedProfile);
                      setIsEditing(false);
                      setMessage("");
                    }}
                    className="h-11 border-gray-300"
                  >
                    <X className="h-4 w-4" /> Annuler
                  </Button>
                  <Button type="submit" disabled={isSaving} className="h-11 bg-gray-950 text-white hover:bg-orange-600">
                    <Check className="h-4 w-4" />
                    {isSaving ? "Enregistrement" : "Enregistrer"}
                  </Button>
                </div>
              )}
            </form>
          </section>
        </div>
      </main>
    </div>
  );
}
