"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { acceptInvitation, previewInvitation } from "@/lib/api";
import { readSession } from "@/lib/session";
import type { InvitationPreview } from "@/lib/types";

export default function InviteAcceptPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const router = useRouter();
  const [preview, setPreview] = useState<InvitationPreview | null>(null);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [error, setError] = useState("");
  const [hasSession, setHasSession] = useState(false);

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
              <button
                className="mt-6 w-full rounded-lg bg-[#FF5100] px-5 py-3 text-sm font-bold hover:bg-[#e64a00] disabled:opacity-60"
                disabled={accepting}
                onClick={() => void handleAccept()}
                type="button"
              >
                {accepting ? "Joining…" : "Accept & join workspace"}
              </button>
            ) : (
              <div className="mt-6 space-y-3">
                <p className="text-xs text-white/50">
                  Sign in with <b>{preview.email}</b> to accept, then reopen this link.
                </p>
                <div className="flex gap-2">
                  <Link
                    className="flex-1 rounded-lg border border-white/20 px-4 py-2.5 text-sm font-semibold hover:bg-white/10"
                    href="/login"
                  >
                    Log in
                  </Link>
                  <Link
                    className="flex-1 rounded-lg bg-[#FF5100] px-4 py-2.5 text-sm font-bold hover:bg-[#e64a00]"
                    href="/register"
                  >
                    Sign up
                  </Link>
                </div>
              </div>
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
