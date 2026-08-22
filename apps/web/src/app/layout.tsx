import type { Metadata } from "next";
import Link from "next/link";

import "./globals.css";

export const metadata: Metadata = {
  title: "Veridict — bounties that pay themselves",
  description:
    "Post a dollar amount, agree the criteria up front, and the escrow settles in ADA at the oracle price when a signed, replayable verdict says the work passed.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <header className="border-b border-edge">
          <nav className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
            <Link href="/" className="font-semibold tracking-tight">
              Veridict
            </Link>
            <div className="flex items-center gap-5 text-sm text-muted">
              <Link href="/board" className="hover:text-slate-100">
                Bounties
              </Link>
              <Link href="/verify" className="hover:text-slate-100">
                Verify
              </Link>
              <a
                href="https://github.com/let-the-dreamers-rise/veridict"
                className="hover:text-slate-100"
              >
                Source
              </a>
              <span className="rounded-full border border-edge px-2.5 py-1 text-xs">Preprod</span>
            </div>
          </nav>
        </header>
        <main className="mx-auto max-w-5xl px-6 py-10">{children}</main>
        <footer className="mx-auto max-w-5xl px-6 py-10 text-xs text-muted">
          Cardano preprod testnet. Nothing here uses real money. Apache-2.0.
        </footer>
      </body>
    </html>
  );
}
