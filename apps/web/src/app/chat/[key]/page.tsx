import { HostedChatLoader } from "./hosted-chat-loader";

interface HostedChatPageProps {
  params: Promise<{ key: string }>;
}

/**
 * A chat that lives at its own link — livechat.example.com/chat/<widget key>.
 *
 * For businesses with no website of their own: a QR code on a restaurant table, a link in an
 * Instagram bio, a line on a visiting card. The same widget, opened full screen, with no page
 * to embed it in.
 */
export default async function HostedChatPage({ params }: HostedChatPageProps) {
  const { key } = await params;

  return (
    <main className="grid min-h-screen place-items-center bg-[#f4f7fb] px-4 py-10 text-slate-900">
      <div className="w-full max-w-md text-center">
        <h1 className="text-2xl font-black">Chat with us</h1>
        <p className="mt-2 text-sm text-slate-600">
          The chat opens in the corner of this page. Ask anything — a person will answer.
        </p>
        <p className="mt-8 text-xs text-slate-400">
          If the chat does not open, this link may have been switched off.
        </p>
      </div>

      <HostedChatLoader widgetKey={key} />
    </main>
  );
}
