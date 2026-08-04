import type { Metadata } from "next";
import "./globals.css";

// The CSP nonce (proxy.ts) is minted per request, so every page must render per request —
// a statically prerendered page would ship scripts without the nonce and the browser would
// refuse to run them. Set on the root layout so no new page can opt back into static.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "PromptForge",
  description: "Score, refine, and save your prompts.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
