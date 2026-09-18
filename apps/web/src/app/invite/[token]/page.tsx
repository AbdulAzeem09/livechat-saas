"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { acceptInvitation, previewInvitation, signUpWithInvitation } from "@/lib/api";
import { clearSession, readSession, saveSession } from "@/lib/session";
import type { InvitationPreview } from "@/lib/types";

export default function InviteAcceptPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const router = useRouter();
  const [preview, setPreview] = useState<InvitationPreview | null>(null);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [error, setError] = useState("");
  const [hasSession, setHasSession] = useState(false);
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");

  useEffect(() => {
    setHasSession(Boolean(readSession()?.accessToken));
    previewInvitation(token)
      .then(setPreview)
      .catch(() => setPreview({ valid: false, email: null, organizationName: null, reason: "Could not load invite" }))
      .finally(() => setLoading(false));
  }, [token]);

  async function handleAccept() {
    const session = readSession();
    if (!session?.accessToken) {
      return;
    }
    setAccepting(true);
    setError("");
    try {
      await acceptInvitation(token, session.accessToken);
      router.replace("/dashboard");
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Could not accept the invite");
      setAccepting(false);
    }
  }

  async function handleSignUp(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAccepting(true);
    setError("");
    try {
      const auth = await signUpWithInvitation(token, { name, password });
      saveSession(auth);
      router.replace("/dashboard");
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Could not create your account");
      setAccepting(false);
    }
  }

  function handleUseAnotherAccount() {
    clearSession();
    setHasSession(false);
    setError("");
  }

  const loginHref = `/login?next=${encodeURIComponent(`/invite/${token}`)}`;
  const inputClass =
    "w-full rounded-lg border border-white/15 bg-[#0b0b0f] px-3 py-2.5 text-sm text-white outline-none placeholder:text-white/30 focus:border-[#FF5100]";

  return (
    <main className="grid min-h-screen place-items-center bg-[#0b0b0f] px-6 text-white">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#141418] p-8 text-center">
        <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-[#FF5100] text-xl font-bold">
          LC
        </span>

        {loading ? (
          <p className="mt-6 text-sm text-white/60">Loading invite…</p>
        ) : preview?.valid ? (
          <>
            <h1 className="mt-6 text-xl font-bold">You&apos;re invited</h1>
            <p className="mt-2 text-sm text-white/60">
              Join <b className="text-white">{preview.organizationName}</b> as an agent
              {preview.email ? (
                <>
                  {" "}
                  ({preview.email})
                </>
              ) : null}
              .
            </p>

            {error ? (
              <div className="mt-4 rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
                {error}
              </div>
            ) : null}

            {hasSession ? (
              <>
                <button
                  className="mt-6 w-full rounded-lg bg-[#FF5100] px-5 py-3 text-sm font-bold hover:bg-[#e64a00] disabled:opacity-60"
                  disabled={accepting}
                  onClick={() => void handleAccept()}
                  type="button"
                >
                  {accepting ? "Joining…" : "Accept & join workspace"}
                </button>
                <button
                  className="mt-3 text-xs text-white/50 underline hover:text-white"
                  onClick={handleUseAnotherAccount}
                  type="button"
                >
                  Not {preview.email}? Use another account
                </button>
              </>
            ) : (
              <>
                <form className="mt-6 grid gap-3 text-left" onSubmit={(event) => void handleSignUp(event)}>
                  <label className="grid gap-1 text-xs font-semibold text-white/70">
                    Email
                    <input className={`${inputClass} opacity-70`} readOnly type="email" value={preview.email ?? ""} />
                  </label>
                  <label className="grid gap-1 text-xs font-semibold text-white/70">
                    Your name
                    <input
                      autoComplete="name"
                      className={inputClass}
                      minLength={2}
                      name="name"
                      onChange={(event) => setName(event.target.value)}
                      placeholder="Sara Ahmed"
                      required
                      value={name}
                    />
                  </label>
                  <label className="grid gap-1 text-xs font-semibold text-white/70">
                    Choose a password
                    <input
                      autoComplete="new-password"
                      className={inputClass}
                      minLength={8}
                      name="password"
                      onChange={(event) => setPassword(event.target.value)}
                      placeholder="Minimum 8 characters"
                      required
                      type="password"
                      value={password}
                    />
                  </label>
                  <button
                    className="mt-2 w-full rounded-lg bg-[#FF5100] px-5 py-3 text-sm font-bold hover:bg-[#e64a00] disabled:opacity-60"
                    disabled={accepting}
                    type="submit"
                  >
                    {accepting ? "Creating account…" : "Create account & join"}
                  </button>
                </form>
                <p className="mt-4 text-xs text-white/50">
                  Already have an account with {preview.email}?{" "}
                  <Link className="font-semibold text-white underline" href={loginHref}>
                    Log in to accept
                  </Link>
                </p>
              </>
            )}
          </>
        ) : (
          <>
            <h1 className="mt-6 text-xl font-bold">Invite unavailable</h1>
            <p className="mt-2 text-sm text-white/60">{preview?.reason ?? "This invite is not valid."}</p>
            <Link
              className="mt-6 inline-block rounded-lg bg-[#FF5100] px-5 py-2.5 text-sm font-bold hover:bg-[#e64a00]"
              href="/login"
            >
              Go to login
            </Link>
          </>
        )}
      </div>
    </main>
  );
}
