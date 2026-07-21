"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Building2, MessageSquare, ShieldCheck, Users } from "lucide-react";
import { adminOverview, type AdminOverviewData } from "@/lib/api";
import { readSession } from "@/lib/session";

export default function AdminPage() {
  const router = useRouter();
  const [data, setData] = useState<AdminOverviewData | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const session = readSession();
    if (!session) {
      router.replace("/login");
      return;
    }
    adminOverview(session.accessToken)
      .then((result) => setData(result))
      .catch((caught) =>
        setError(caught instanceof Error ? caught.message : "Not authorized")
      )
      .finally(() => setLoading(false));
  }, [router]);

  if (loading) {
    return <main className="grid min-h-screen place-items-center bg-[#0f1115] text-white/60">Loading…</main>;
  }

  if (error || !data) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#0f1115] px-6 text-center text-white">
        <div>
          <ShieldCheck className="mx-auto h-10 w-10 text-rose-400" aria-hidden />
          <h1 className="mt-4 text-xl font-bold">Super-admin access only</h1>
          <p className="mt-2 text-sm text-white/50">{error || "You don't have access to this panel."}</p>
          <Link className="mt-6 inline-block rounded-lg bg-[#2f6bff] px-5 py-2 text-sm font-bold" href="/dashboard">
            Back to dashboard
          </Link>
        </div>
      </main>
    );
  }

  const cards = [
    { label: "Organizations", value: data.totals.organizations, icon: Building2 },
    { label: "Users", value: data.totals.users, icon: Users },
    { label: "Conversations", value: data.totals.conversations, icon: MessageSquare },
    { label: "Active subscriptions", value: data.totals.activeSubscriptions, icon: ShieldCheck }
  ];

  return (
    <main className="min-h-screen bg-[#0f1115] px-6 py-8 text-white md:px-10">
      <div className="mx-auto max-w-6xl">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Platform Admin</h1>
            <p className="text-sm text-white/50">All client accounts across your LiveChat SaaS.</p>
          </div>
          <Link className="rounded-lg border border-white/15 px-4 py-2 text-sm font-semibold hover:bg-white/5" href="/dashboard">
            Dashboard
          </Link>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {cards.map((card) => (
            <div className="rounded-xl border border-white/10 bg-[#181b21] p-5" key={card.label}>
              <card.icon className="h-5 w-5 text-[#4ea2ff]" aria-hidden />
              <p className="mt-3 text-3xl font-bold tabular-nums">{card.value}</p>
              <p className="text-xs text-white/50">{card.label}</p>
            </div>
          ))}
        </div>

        <div className="mt-8 overflow-hidden rounded-xl border border-white/10">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b border-white/10 bg-[#181b21] text-xs font-bold uppercase tracking-wide text-white/40">
                  <th className="px-4 py-3 text-left">Company</th>
                  <th className="px-4 py-3 text-left">Plan</th>
                  <th className="px-4 py-3 text-left">Status</th>
                  <th className="px-4 py-3 text-right">Agents</th>
                  <th className="px-4 py-3 text-right">Chats</th>
                  <th className="px-4 py-3 text-right">Joined</th>
                </tr>
              </thead>
              <tbody>
                {data.organizations.map((org) => (
                  <tr className="border-b border-white/5 hover:bg-white/[0.03]" key={org.id}>
                    <td className="px-4 py-3">
                      <div className="font-semibold">{org.name}</div>
                      <div className="text-xs text-white/40">{org.slug}</div>
                    </td>
                    <td className="px-4 py-3 capitalize text-white/70">{org.planCode}</td>
                    <td className="px-4 py-3">
                      <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs">{org.status}</span>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-white/70">{org.members}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-white/70">{org.conversations}</td>
                    <td className="px-4 py-3 text-right text-xs text-white/50">
                      {new Date(org.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </main>
  );
}
