import { EVIDENCE, ORACLE_PUBLIC_KEY, shorten } from "@/lib/config";

/**
 * The running strip under the header.
 *
 * Every value in it is real and checkable, which is the point: a ticker of
 * invented numbers would be decoration, and this product's entire argument is
 * that its numbers are not invented.
 */
const ITEMS: readonly { label: string; value: string; tone?: "pass" | "fail" }[] = [
  { label: "ADA/USD", value: "0.40000000" },
  { label: "RESOLVE", value: shorten(EVIDENCE.pricedSettlement, 8, 8), tone: "pass" },
  { label: "PAID", value: "30.000000 tADA" },
  { label: "RESOLVE", value: shorten(EVIDENCE.withheldPayout, 8, 8), tone: "fail" },
  { label: "WITHHELD", value: "25.000000 tADA", tone: "fail" },
  { label: "ORACLE", value: shorten(ORACLE_PUBLIC_KEY, 8, 6) },
  { label: "NETWORK", value: "PREPROD" },
];

function Strip({ hidden = false }: { hidden?: boolean }) {
  return (
    <div
      aria-hidden={hidden}
      className="vd-mono flex w-1/2 flex-none gap-[34px] py-[9px] text-[11px] tracking-[0.02em] whitespace-nowrap"
      style={{ color: "var(--vd-dim)" }}
    >
      {ITEMS.map((item, index) => (
        <span key={`${item.label}-${index}`}>
          {item.label}{" "}
          <span
            style={{
              color:
                item.tone === "fail"
                  ? "var(--vd-accent)"
                  : item.tone === "pass"
                    ? "var(--vd-accent-light)"
                    : "#fff",
            }}
          >
            {item.value}
          </span>
        </span>
      ))}
    </div>
  );
}

export function Ticker() {
  return (
    <div
      className="overflow-hidden"
      style={{ borderBottom: "1px solid var(--vd-line)", background: "rgba(255,255,255,.02)" }}
    >
      <div className="flex w-[200%]" style={{ animation: "vd-tick 42s linear infinite" }}>
        <Strip />
        <Strip hidden />
      </div>
    </div>
  );
}
