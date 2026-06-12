import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "LiveChat SaaS",
  description: "Agent dashboard and live chat workspace"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
