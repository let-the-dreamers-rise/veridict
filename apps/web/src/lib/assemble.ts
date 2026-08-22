"use client";

/**
 * Combines a server-built transaction with the wallet's witness.
 *
 * CIP-30 partial signing returns only a witness set, which has to be merged
 * back into the original transaction before submission. Lucid is imported
 * lazily so its WASM payload is only fetched when someone actually signs
 * something, rather than on every page load.
 */
export async function assembleTx(unsignedCbor: string, witnessCbor: string): Promise<string> {
  const { CML } = await import("@lucid-evolution/lucid");

  const tx = CML.Transaction.from_cbor_hex(unsignedCbor);
  const existing = tx.witness_set();
  const incoming = CML.TransactionWitnessSet.from_cbor_hex(witnessCbor);

  const vkeys = incoming.vkeywitnesses();
  if (vkeys !== undefined) {
    const merged = existing.vkeywitnesses() ?? CML.VkeywitnessList.new();
    for (let i = 0; i < vkeys.len(); i += 1) {
      merged.add(vkeys.get(i));
    }
    existing.set_vkeywitnesses(merged);
  }

  return CML.Transaction.new(tx.body(), existing, true, tx.auxiliary_data()).to_cbor_hex();
}
