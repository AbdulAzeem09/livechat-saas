"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Building2, KeyRound } from "lucide-react";
import { getGoogleAuthUrl, register } from "@/lib/api";
import { slugify } from "@/lib/format";
import { saveSession } from "@/lib/session";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/text-field";

export function RegisterForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [organizationName, setOrganizationName] = useState("");
  const [organizationSlug, setOrganizationSlug] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const computedSlug = useMemo(
    () => organizationSlug || slugify(organizationName),
    [organizationName, organizationSlug]
  );

  async function handleGoogle() {
    setError("");
    setIsGoogleLoading(true);
    try {
      const { authUrl } = await getGoogleAuthUrl();
      window.location.href = authUrl;
    } catch {
      setError("Google sign-up isn't configured yet. Add GOOGLE_CLIENT_ID/SECRET in the API .env.");
      setIsGoogleLoading(false);
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      const auth = await register({
        name,
        email,
        password,
        organizationName,
        ...(computedSlug ? { organizationSlug: computedSlug } : {})
      });
      saveSession(auth);
      router.push("/dashboard");
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Registration failed");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form className="grid gap-4" onSubmit={handleSubmit}>
      {error ? (
        <div className="rounded-md border border-coral-500/30 bg-coral-500/10 px-3 py-2 text-sm font-medium text-coral-500">
          {error}
        </div>
      ) : null}
      <TextField
        autoComplete="name"
        label="Name"
        minLength={2}
        name="name"
        onChange={(event) => setName(event.target.value)}
        placeholder="Azeem Khan"
        required
        value={name}
      />
      <TextField
        autoComplete="email"
        label="Email"
        name="email"
        onChange={(event) => setEmail(event.target.value)}
        placeholder="owner@example.com"
        required
        type="email"
        value={email}
      />
      <TextField
        autoComplete="new-password"
        label="Password"
        minLength={8}
        name="password"
        onChange={(event) => setPassword(event.target.value)}
        placeholder="Minimum 8 characters"
        required
        type="password"
        value={password}
      />
      <TextField
        label="Organization"
        minLength={2}
        name="organizationName"
        onChange={(event) => setOrganizationName(event.target.value)}
        placeholder="Azeem Support"
        required
        value={organizationName}
      />
      <TextField
        label="Workspace slug"
        name="organizationSlug"
        onChange={(event) => setOrganizationSlug(slugify(event.target.value))}
        placeholder={computedSlug || "azeem-support"}
        value={organizationSlug}
      />
      <Button
        className="mt-2 w-full"
        icon={<ArrowRight className="h-4 w-4" aria-hidden />}
        isLoading={isSubmitting}
        type="submit"
      >
        Create workspace
      </Button>
      <Button
        className="w-full"
        icon={<Building2 className="h-4 w-4" aria-hidden />}
        onClick={() => setOrganizationName("Azeem Support")}
        type="button"
        variant="secondary"
      >
        Fill workspace
      </Button>
      <div className="relative my-1 flex items-center gap-3">
        <span className="h-px flex-1 bg-white/10" />
        <span className="text-xs font-medium text-white/40">or</span>
        <span className="h-px flex-1 bg-white/10" />
      </div>
      <Button
        className="w-full"
        icon={<KeyRound className="h-4 w-4" aria-hidden />}
        isLoading={isGoogleLoading}
        onClick={() => void handleGoogle()}
        type="button"
        variant="secondary"
      >
        Continue with Google
      </Button>
    </form>
  );
}
