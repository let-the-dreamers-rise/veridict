import type { Metadata } from "next";
import { Archivo } from "next/font/google";

import { Backdrop } from "@/components/Backdrop";
import { Nav } from "@/components/Nav";
import { Ticker } from "@/components/Ticker";
import { SCRIPT_ADDRESS } from "@/lib/config";

import "./globals.css";

const archivo = Archivo({
  subsets: ["latin"],
  weight: ["400", "600", "800"],
  variable: "--font-archivo",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Veridict — bounties that pay themselves",
  description:
    "Post a task with a dollar amount and the criteria the work must meet. The criteria are locked on chain before any money is. A signed verdict then releases the payment, or withholds it.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={archivo.variable}>
      <body>
        <Backdrop />
        <div className="relative z-[2] min-h-screen">
          <Nav />
          <Ticker />
          <main>{children}</main>
          <footer
            className="vd-shell py-14"
            style={{ borderTop: "1px solid var(--vd-line)", marginTop: "64px" }}
          >
            <div className="grid gap-5 md:grid-cols-[180px_minmax(0,1fr)]">
              <span className="vd-eyebrow">Escrow contract</span>
              <span className="vd-mono break-all text-[12px]" style={{ color: "var(--vd-soft)" }}>
                {SCRIPT_ADDRESS}
              </span>
            </div>
            <p className="mt-8 max-w-[62ch] text-[13px] leading-[22px]" style={{ color: "var(--vd-dim)" }}>
              Cardano preprod testnet. Nothing here uses real money, and there are no outside users
              yet — this site will say so until there are. Source is Apache-2.0 at{" "}
              <a href="https://github.com/let-the-dreamers-rise/veridict">github.com/let-the-dreamers-rise/veridict</a>.
            </p>
          </footer>
        </div>
      </body>
    </html>
  );
}
