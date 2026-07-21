import { WidgetDemoLoader } from "./widget-demo-loader";

interface WidgetDemoPageProps {
  searchParams: Promise<{
    key?: string | string[];
  }>;
}

export default async function WidgetDemoPage({ searchParams }: WidgetDemoPageProps) {
  const params = await searchParams;
  const key = Array.isArray(params.key) ? params.key[0] : params.key;
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";
  const scriptUrl = `${apiUrl.replace(/\/$/, "")}/widget.js`;

  return (
    <main className="min-h-screen bg-[#f4f7fb] text-slate-950">
      <section className="mx-auto flex min-h-screen max-w-5xl flex-col justify-center px-6 py-12">
        <div className="mb-8 max-w-2xl">
          <p className="text-sm font-bold uppercase tracking-[0.18em] text-[#ff5a00]">
            Customer website demo
          </p>
          <h1 className="mt-4 text-4xl font-black leading-tight md:text-6xl">
            Test your live chat widget on a real page
          </h1>
          <p className="mt-5 text-lg leading-8 text-slate-600">
            This page behaves like a customer website. Open the orange chat button, send a
            message, then watch the agent dashboard receive the visitor conversation.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {[
            ["1", "Open chat", "Use the floating widget in the bottom corner."],
            ["2", "Send message", "The visitor message is stored in the shared backend."],
            ["3", "Check dashboard", "Agents see the chat instantly through Socket.IO."]
          ].map(([step, title, copy]) => (
            <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm" key={step}>
              <span className="grid h-8 w-8 place-items-center rounded-full bg-[#111214] text-sm font-bold text-white">
                {step}
              </span>
              <h2 className="mt-4 text-lg font-bold">{title}</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">{copy}</p>
            </div>
          ))}
        </div>

        {!key && (
          <div className="mt-8 rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            Missing widget key. Open this page from Dashboard &gt; Settings &gt; Open demo site.
          </div>
        )}
      </section>

      {key && <WidgetDemoLoader scriptUrl={scriptUrl} widgetKey={key} />}
    </main>
  );
}
