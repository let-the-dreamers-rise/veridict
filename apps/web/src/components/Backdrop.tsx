/**
 * The fixed glow and grid behind everything.
 *
 * Both layers are non-interactive and sit at z-index 0; all content is raised
 * above them, so the atmosphere never intercepts a click.
 */
export function Backdrop() {
  return (
    <>
      <div
        className="pointer-events-none fixed inset-0 z-0"
        style={{
          background:
            "radial-gradient(900px 620px at 78% -6%,rgba(236,48,19,.20),transparent 62%),radial-gradient(760px 520px at 6% 22%,rgba(236,48,19,.09),transparent 60%),radial-gradient(1200px 800px at 50% 118%,rgba(255,151,131,.07),transparent 60%)",
        }}
      />
      <div
        className="pointer-events-none fixed inset-0 z-0 opacity-50"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,.045) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.045) 1px,transparent 1px)",
          backgroundSize: "76px 76px",
          maskImage: "radial-gradient(1100px 800px at 50% 12%,#000 30%,transparent 78%)",
          WebkitMaskImage: "radial-gradient(1100px 800px at 50% 12%,#000 30%,transparent 78%)",
        }}
      />
    </>
  );
}
