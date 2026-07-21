"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, KeyRound } from "lucide-react";
import { getGoogleAuthUrl, login } from "@/lib/api";
import { saveSession } from "@/lib/session";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/text-field";

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const errorParam = params.get("error");
    if (errorParam) {
      setError(errorParam);
    }
  }, []);

  async function handleGoogle() {
    setError("");
    setIsGoogleLoading(true);
    try {
      const { authUrl } = await getGoogleAuthUrl();
      window.location.href = authUrl;
    } catch {
      setError("Google sign-in isn't configured yet. Add GOOGLE_CLIENT_ID/SECRET in the API .env.");
      setIsGoogleLoading(false);
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      const auth = await login(email, password);
      saveSession(auth);
      router.push("/dashboard");
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Login failed");
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
        autoComplete="current-password"
        label="Password"
        minLength={8}
        name="password"
        onChange={(event) => setPassword(event.target.value)}
        placeholder="********"
        required
        type="password"
        value={password}
      />
      <Button
        className="mt-2 w-full"
        icon={<ArrowRight className="h-4 w-4" aria-hidden />}
        isLoading={isSubmitting}
        type="submit"
      >
        Continue
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
