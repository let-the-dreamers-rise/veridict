import { NextResponse } from "next/server";
import { criteriaSetSchema, hashCriteriaSetHex } from "@veridict/shared";
import { createBountyTx, escrowContext } from "@veridict/offchain";

import { escrowScript, serverLucid, useAddress } from "@/lib/server-lucid";
import {
  FEED_ASSET_NAME,
  FEED_POLICY,
  ORACLE_PUBLIC_KEY,
  PRICE_SCALE,
} from "@/lib/config";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Builds an unsigned bounty-creation transaction.
 *
 * The criteria are supplied by the poster and hashed here; that hash goes on
 * chain and fixes the standard before any money is locked. The response is
 * unsigned, so the poster signs in their own wallet and can see exactly what
 * they are agreeing to.
 */

interface CreateBody {
  address?: unknown;
  specText?: unknown;
  usdAmount?: unknown;
  stakeAda?: unknown;
  criteria?: unknown;
  deadlineDays?: unknown;
}

const MAX_USD = 10_000;
const MAX_STAKE_ADA = 5_000;

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const body = (await request.json()) as CreateBody;

    const address = typeof body.address === "string" ? body.address.trim() : "";
    const specText = typeof body.specText === "string" ? body.specText.trim() : "";
    const usdAmount = Number(body.usdAmount);
    const stakeAda = Number(body.stakeAda);
    const deadlineDays = Number(body.deadlineDays ?? 7);

    if (!address.startsWith("addr_test")) {
      return NextResponse.json(
        { error: "A preprod wallet address is required." },
        { status: 400 },
      );
    }
    if (specText.length < 20) {
      return NextResponse.json(
        { error: "Describe the task in at least 20 characters so a worker knows what to do." },
        { status: 400 },
      );
    }
    if (!Number.isFinite(usdAmount) || usdAmount <= 0 || usdAmount > MAX_USD) {
      return NextResponse.json(
        { error: `The reward must be between $0.01 and $${MAX_USD}.` },
        { status: 400 },
      );
    }
    if (!Number.isFinite(stakeAda) || stakeAda < 5 || stakeAda > MAX_STAKE_ADA) {
      return NextResponse.json(
        { error: `The stake must be between 5 and ${MAX_STAKE_ADA} tADA.` },
        { status: 400 },
      );
    }

    const criteria = Array.isArray(body.criteria) ? body.criteria : [];
    if (criteria.length === 0) {
      return NextResponse.json(
        { error: "Add at least one criterion. Nobody should be judged against an unwritten rule." },
        { status: 400 },
      );
    }

    const criteriaSet = criteriaSetSchema.parse({
      version: 1,
      specText,
      passThresholdBps: 10_000,
      criteria: criteria.map((entry, index) => {
        const row = entry as { title?: unknown; rubric?: unknown };
        const title = typeof row.title === "string" ? row.title.trim() : "";
        return {
          id: `criterion-${index + 1}`,
          title: title.length > 0 ? title.slice(0, 200) : `Criterion ${index + 1}`,
          kind: "judgment" as const,
          rubric:
            typeof row.rubric === "string" && row.rubric.trim().length >= 20
              ? row.rubric.trim()
              : `Decide whether the submission satisfies: ${title}`,
          passConditions: [title.length > 0 ? title : `Criterion ${index + 1}`],
          weight: 100,
          mandatory: true,
        };
      }),
    });

    const lucid = await serverLucid();
    await useAddress(lucid, address);
    const context = escrowContext(lucid, "Preprod", escrowScript());

    const unsigned = await createBountyTx(context, {
      posterAddress: address,
      oracleKeyHex: ORACLE_PUBLIC_KEY,
      arbiterAddress: address,
      treasuryAddress: address,
      criteriaHash: hashCriteriaSetHex(criteriaSet),
      rewardLovelace: BigInt(Math.round(stakeAda * 1_000_000)),
      rewardUsdMicro: BigInt(Math.round(usdAmount * 1_000_000)),
      priceScale: PRICE_SCALE,
      oraclePolicy: FEED_POLICY,
      oracleName: FEED_ASSET_NAME,
      deadline: Date.now() + deadlineDays * 24 * 60 * 60 * 1000,
      appealWindowMs: 3 * 24 * 60 * 60 * 1000,
      protocolFeeBps: 250,
      oracleKeyVersion: 1,
    });

    return NextResponse.json({
      unsignedTx: unsigned,
      criteriaHash: hashCriteriaSetHex(criteriaSet),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not build the transaction.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
