"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { resetPassword } from "@/lib/api";
import { AuthShell } from "@/components/auth/auth-shell";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/text-field";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [token, setToken] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    setToken(new URLSearchParams(window.location.search).get("token") ?? "");
  }, []);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setError("The two passwords don't match.");
      return;
    }

    setIsSubmitting(true);
    try {
      await resetPassword(token, password);
      setDone(true);
      setTimeout(() => router.push("/login"), 2500);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Could not reset the password");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AuthShell mode="login">
      <div className="grid gap-4">
        <div>
          <h2 className="text-xl font-bold">Set a new password</h2>
          <p className="mt-1 text-sm text-slate-500">
            For your security, this signs you out everywhere else.
          </p>
        </div>

        {error ? (
          <div className="rounded-md border border-coral-500/30 bg-coral-500/10 px-3 py-2 text-sm font-medium text-coral-500">
            {error}
          </div>
        ) : null}

        {done ? (
          <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-3 text-sm text-emerald-800">
            Password updated. Taking you to the login page…
          </div>
        ) : !token ? (
          <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-amber-800">
            This link is missing its token. Please open the link from the email again, or{" "}
            <Link className="font-semibold underline" href="/forgot-password">
              request a new one
            </Link>
            .
          </div>
        ) : (
          <form className="grid gap-4" onSubmit={handleSubmit}>
            <TextField
              autoComplete="new-password"
              label="New password"
              minLength={8}
              name="password"
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Minimum 8 characters"
              required
              type="password"
              value={password}
            />
            <TextField
              autoComplete="new-password"
              label="Confirm new password"
              minLength={8}
              name="confirmPassword"
              onChange={(event) => setConfirmPassword(event.target.value)}
              placeholder="Type it again"
              required
              type="password"
              value={confirmPassword}
            />
            <Button disabled={isSubmitting} type="submit">
              {isSubmitting ? "Saving…" : "Save new password"}
            </Button>
          </form>
        )}
      </div>
    </AuthShell>
  );
}
