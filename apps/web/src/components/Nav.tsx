"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "Protocol" },
  { href: "/board", label: "Bounties" },
  { href: "/create", label: "Post" },
  { href: "/verify", label: "Verify" },
] as const;

/**
 * The active link carries a glowing underline rather than a colour change, so
 * the nav reads as an instrument panel with one lit channel at a time.
 */
export function Nav() {
  const pathname = usePathname();

  return (
    <div
      className="sticky top-0 z-40"
      style={{
        background: "rgba(8,8,11,.82)",
        backdropFilter: "blur(14px)",
        borderBottom: "1px solid var(--vd-line)",
      }}
    >
      <div className="vd-shell">
        <div className="flex items-center gap-8 py-[15px]">
          <Link href="/" className="mr-auto flex items-center gap-[10px] no-underline">
            <span
              className="block h-[22px] w-[22px]"
              style={{ background: "var(--vd-accent)", boxShadow: "0 0 22px rgba(236,48,19,.85)" }}
            />
            <span className="text-[19px] font-extrabold uppercase tracking-[-0.03em]" style={{ color: "#fff" }}>
              Veridict
            </span>
          </Link>

          <div className="flex items-center gap-[26px]">
            {LINKS.map((link) => {
              const active = link.href === "/" ? pathname === "/" : pathname.startsWith(link.href);
              return (
                <span key={link.href} className="flex flex-col gap-[6px]">
                  <Link
                    href={link.href}
                    className="whitespace-nowrap text-[11.5px] font-semibold uppercase leading-[1.2] tracking-[0.13em] no-underline"
                    style={{ color: "var(--vd-ink)" }}
                  >
                    {link.label}
                  </Link>
                  {active ? (
                    <span
                      className="block h-[2px]"
                      style={{ background: "var(--vd-accent)", boxShadow: "0 0 12px rgba(236,48,19,.9)" }}
                    />
                  ) : null}
                </span>
              );
            })}

            <span
              className="inline-flex items-center gap-[7px] whitespace-nowrap px-[11px] py-[5px] text-[10px] font-semibold uppercase leading-none tracking-[0.14em]"
              style={{ border: "1px solid rgba(236,48,19,.5)", color: "var(--vd-accent-light)" }}
            >
              <span
                className="h-[6px] w-[6px] rounded-full"
                style={{
                  background: "var(--vd-accent)",
                  boxShadow: "0 0 10px var(--vd-accent)",
                  animation: "vd-pulse 1.9s ease-in-out infinite",
                }}
              />
              Preprod live
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
