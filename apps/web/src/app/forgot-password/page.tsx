"use client";

import { useState } from "react";
import Link from "next/link";
import { requestPasswordReset } from "@/lib/api";
import { AuthShell } from "@/components/auth/auth-shell";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/text-field";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    try {
      await requestPasswordReset(email);
    } catch {
      // The API never reveals whether an account exists; show the same message either way.
    } finally {
      setSent(true);
      setIsSubmitting(false);
    }
  }

  return (
    <AuthShell mode="login">
      <div className="grid gap-4">
        <div>
          <h2 className="text-xl font-bold">Forgot your password?</h2>
          <p className="mt-1 text-sm text-slate-500">
            Enter your email and we&apos;ll send you a link to set a new one.
          </p>
        </div>

        {sent ? (
          <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-3 text-sm text-emerald-800">
            If an account exists for <b>{email}</b>, a reset link is on its way. The link expires in 1 hour.
          </div>
        ) : (
          <form className="grid gap-4" onSubmit={handleSubmit}>
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
            <Button disabled={isSubmitting} type="submit">
              {isSubmitting ? "Sending…" : "Send reset link"}
            </Button>
          </form>
        )}

        <p className="text-sm text-slate-500">
          <Link className="font-semibold text-[#FF5100] hover:underline" href="/login">
            Back to log in
          </Link>
        </p>
      </div>
    </AuthShell>
  );
}
