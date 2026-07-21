import Link from "next/link";
import { Check, Minus } from "lucide-react";
import { MarketingCta, MarketingFooter, MarketingHeader } from "@/components/marketing/marketing-chrome";

type Cell = boolean | string;

const COLUMNS = ["Our LiveChat", "Intercom", "Zendesk Chat", "Tawk.to"] as const;

const ROWS: { label: string; cells: [Cell, Cell, Cell, Cell] }[] = [
  { label: "Real-time chat widget", cells: [true, true, true, true] },
  { label: "Chatbot + knowledge base training", cells: [true, true, true, false] },
  { label: "AI reply suggestions", cells: [true, true, false, false] },
  { label: "Visitor tracking + geo-location", cells: [true, true, true, "Limited"] },
  { label: "Proactive campaigns & eye-catchers", cells: [true, true, "Add-on", false] },
  { label: "Built-in ticketing (HelpDesk)", cells: [true, "Add-on", true, false] },
  { label: "Reports & CSAT", cells: [true, true, true, "Basic"] },
  { label: "WordPress & Shopify plugins", cells: [true, true, true, true] },
  { label: "Self-hostable / own database", cells: [true, false, false, false] },
  { label: "Transparent flat pricing", cells: [true, false, false, "Free tier"] }
];

function renderCell(value: Cell) {
  if (value === true) {
    return <Check className="mx-auto h-4 w-4 text-emerald-500" aria-label="Yes" />;
  }
  if (value === false) {
    return <Minus className="mx-auto h-4 w-4 text-slate-300" aria-label="No" />;
  }
  return <span className="text-xs font-medium text-slate-500">{value}</span>;
}

export default function ComparePage() {
  return (
    <main className="min-h-screen bg-white text-[#111214]">
      <MarketingHeader />

      <section className="mx-auto max-w-4xl px-6 py-16 text-center">
        <p className="text-sm font-bold uppercase tracking-wide text-[#FF5100]">Compare</p>
        <h1 className="mx-auto mt-3 max-w-2xl text-4xl font-bold md:text-5xl">How we stack up</h1>
        <p className="mx-auto mt-4 max-w-lg text-slate-500">
          All the features of the big players — without the per-seat surprise bills.
        </p>
      </section>

      <section className="mx-auto max-w-5xl px-6 pb-20">
        <div className="overflow-x-auto rounded-2xl border border-slate-200">
          <table className="w-full min-w-[640px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="px-4 py-4 font-bold">Feature</th>
                {COLUMNS.map((col, i) => (
                  <th
                    className={`px-4 py-4 text-center font-bold ${i === 0 ? "text-[#FF5100]" : "text-slate-500"}`}
                    key={col}
                  >
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ROWS.map((row) => (
                <tr className="border-b border-slate-100 last:border-0" key={row.label}>
                  <td className="px-4 py-3 font-medium text-slate-700">{row.label}</td>
                  {row.cells.map((cell, i) => (
                    <td className={`px-4 py-3 text-center ${i === 0 ? "bg-[#fff8f4]" : ""}`} key={i}>
                      {renderCell(cell)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-4 text-center text-xs text-slate-400">
          Comparison for illustration. Competitor features change — check their sites for the latest.
        </p>
        <div className="mt-8 text-center">
          <Link
            className="inline-block rounded-lg bg-[#FF5100] px-6 py-3 text-sm font-bold text-white hover:bg-[#e64a00]"
            href="/register"
          >
            Switch to LiveChat
          </Link>
        </div>
      </section>

      <MarketingCta />
      <MarketingFooter />
    </main>
  );
}
