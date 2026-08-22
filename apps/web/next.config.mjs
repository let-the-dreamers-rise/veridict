/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // The shared package is the single source of the signed preimage. Bundling it
  // rather than reimplementing the digest here is what stops the two drifting.
  transpilePackages: ["@veridict/shared"],
  // Lucid loads a WASM module that webpack does not carry into the server
  // bundle, so it is left external and resolved from node_modules at runtime.
  serverExternalPackages: ["@lucid-evolution/lucid"],
  // Lucid pulls in WASM for CBOR and crypto; both are needed client side to
  // build transactions in the browser without ever sending a key anywhere.
  webpack: (config) => {
    config.experiments = { ...config.experiments, asyncWebAssembly: true, topLevelAwait: true };
    return config;
  },
};

export default nextConfig;
