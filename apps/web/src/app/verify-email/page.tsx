"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { verifyEmail } from "@/lib/api";

export default function VerifyEmailPage() {
  const [state, setState] = useState<"checking" | "done" | "failed">("checking");
  const [error, setError] = useState("");
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current) {
      return;
    }
    startedRef.current = true;

    const token = new URLSearchParams(window.location.search).get("token");
    if (!token) {
      setState("failed");
      setError("This link is missing its token.");
      return;
    }

    verifyEmail(token)
      .then(() => setState("done"))
      .catch((caughtError: unknown) => {
        setState("failed");
        setError(caughtError instanceof Error ? caughtError.message : "Could not confirm this email");
      });
  }, []);

  return (
    <main className="grid min-h-screen place-items-center bg-[#0b0b0f] px-6 text-white">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#141418] p-8 text-center">
        <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-[#0067FF] text-xl font-bold">
          LC
        </span>

        {state === "checking" ? (
          <p className="mt-6 text-sm text-white/60">Confirming your email…</p>
        ) : state === "done" ? (
          <>
            <h1 className="mt-6 text-xl font-bold">Email confirmed</h1>
            <p className="mt-2 text-sm text-white/60">Thanks — your address is verified.</p>
          </>
        ) : (
          <>
            <h1 className="mt-6 text-xl font-bold">Link didn&apos;t work</h1>
            <p className="mt-2 text-sm text-white/60">{error}</p>
            <p className="mt-2 text-xs text-white/40">
              Open the dashboard and use &quot;Resend&quot; to get a fresh link.
            </p>
          </>
        )}

        <Link
          className="mt-6 inline-block rounded-lg bg-[#0067FF] px-5 py-2.5 text-sm font-bold hover:bg-[#0050C7]"
          href="/dashboard"
        >
          Go to dashboard
        </Link>
      </div>
    </main>
  );
}
