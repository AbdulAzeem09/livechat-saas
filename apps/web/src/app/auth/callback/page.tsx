"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getCurrentUser } from "@/lib/api";
import { saveSession } from "@/lib/session";

export default function AuthCallbackPage() {
  const router = useRouter();
  const [error, setError] = useState("");

  useEffect(() => {
    const fragment = window.location.hash.startsWith("#")
      ? window.location.hash.slice(1)
      : window.location.hash;
    const params = new URLSearchParams(fragment);
    const accessToken = params.get("accessToken");
    const refreshToken = params.get("refreshToken");

    if (!accessToken || !refreshToken) {
      setError("Sign-in link was missing tokens. Please try again.");
      return;
    }

    let cancelled = false;

    getCurrentUser(accessToken)
      .then((user) => {
        if (cancelled) {
          return;
        }
        saveSession({
          accessToken,
          refreshToken,
          user,
          // These aren't used client-side; the stored session only needs tokens + user.
          expiresInSeconds: 0,
          refreshExpiresInSeconds: 0
        });
        // Clear the fragment so tokens don't linger in the URL/history.
        window.history.replaceState(null, "", "/auth/callback");
        router.replace("/dashboard");
      })
      .catch(() => {
        if (!cancelled) {
          setError("Could not complete sign-in. Please try again.");
        }
      });

    return () => {
      cancelled = true;
    };
  }, [router]);

  return (
    <main className="grid min-h-screen place-items-center bg-[#0b0b0f] px-6 text-center text-white">
      <div>
        {error ? (
          <>
            <p className="text-lg font-bold">Sign-in failed</p>
            <p className="mt-2 text-sm text-white/60">{error}</p>
            <a
              className="mt-5 inline-block rounded-lg bg-[#FF5100] px-5 py-2.5 text-sm font-bold hover:bg-[#e64a00]"
              href="/login"
            >
              Back to login
            </a>
          </>
        ) : (
          <>
            <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-white" />
            <p className="mt-4 text-sm text-white/60">Signing you in…</p>
          </>
        )}
      </div>
    </main>
  );
}
