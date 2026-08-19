#!/usr/bin/env node
import { BlockfrostClient } from "./blockfrost.js";
import { verifyResolution } from "./verify.js";

/**
 * veridict-verify <tx-hash>
 *
 * Independently checks a Veridict resolution using nothing but a public chain
 * indexer. Point it at any Blockfrost project id, including one that has never
 * heard of this project.
 */

const DEFAULT_URL = "https://cardano-preprod.blockfrost.io/api/v0";

function usage(): never {
  console.error("Usage: veridict-verify <tx-hash>");
  console.error("");
  console.error("Environment:");
  console.error("  BLOCKFROST_PROJECT_ID   required");
  console.error(`  BLOCKFROST_URL          optional, defaults to ${DEFAULT_URL}`);
  process.exit(2);
}

const txHash = process.argv[2];
if (txHash === undefined || !/^[0-9a-f]{64}$/.test(txHash)) {
  usage();
}

const projectId = process.env["BLOCKFROST_PROJECT_ID"];
if (projectId === undefined || projectId.length === 0) {
  console.error("BLOCKFROST_PROJECT_ID is not set.");
  process.exit(2);
}

const client = new BlockfrostClient(process.env["BLOCKFROST_URL"] ?? DEFAULT_URL, projectId);

try {
  const report = await verifyResolution(client, txHash);

  const line = (label: string, value: string): void => {
    console.log(`  ${label.padEnd(22)} ${value}`);
  };

  console.log("");
  console.log("Veridict verification");
  console.log("");
  line("resolution tx", report.txHash);
  line("bounty utxo", `${report.bountyRef.txHash}#${String(report.bountyRef.outputIndex)}`);
  line("script address", report.scriptAddress);
  console.log("");
  line("oracle key (datum)", report.oracleKeyHex);
  line("criteria hash", report.criteriaHashHex);
  line("submission hash", report.submissionHashHex);
  line("evidence root", report.evidenceRootHex);
  line("verdict digest", report.digestHex);
  console.log("");
  line("verdict", report.pass ? "PASS" : "FAIL");
  line("score", `${String(report.scoreBps)} bps`);
  line("issued at", new Date(report.issuedAt).toISOString());
  console.log("");
  line("signature valid", report.signatureValid ? "yes" : "NO");
  line("criteria bound", report.criteriaHashMatchesDatum ? "yes" : "NO");
  line("funds released", report.fundsMoved ? "yes" : "no, still in contract");
  console.log("");

  if (!report.signatureValid || !report.criteriaHashMatchesDatum) {
    console.log("VERIFICATION FAILED: this resolution is not properly authorised.");
    process.exit(1);
  }

  // The two states that should exist, and the two that should not: a passing
  // verdict must release funds, and a failing one must not.
  if (report.pass && !report.fundsMoved) {
    console.log("INCONSISTENT: verdict passed but funds stayed in the contract.");
    process.exit(1);
  }

  if (!report.pass && report.fundsMoved) {
    console.log("INCONSISTENT: verdict failed but funds left the contract.");
    process.exit(1);
  }

  console.log(
    report.pass
      ? "VERIFIED: the oracle key named in the bounty signed this passing verdict, and the reward was released."
      : "VERIFIED: the oracle key named in the bounty signed this failing verdict, and the reward was withheld.",
  );
  process.exit(0);
} catch (error) {
  console.error(`Verification error: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}
