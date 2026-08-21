use aiken/collection/list
use aiken/collection/pairs
use cardano/assets.{AssetName, PolicyId, quantity_of}
use cardano/transaction.{Input, InlineDatum}

/// Reading a Charli3-standard price feed.
///
/// The feed lives in its own UTxO, which we never spend. It is passed to our
/// transaction as a reference input, read, and left exactly where it was. That
/// is the property that makes an oracle usable by many consumers at once: no
/// contention, no permission needed from the oracle operator.
///
/// The datum layout mirrors the Charli3 standard: a price map keyed by integer,
/// where 0 is the price, 1 the timestamp, and 2 the expiry.

pub type PriceMap =
  Pairs<Int, Int>

pub type PriceData {
  SharedData
  ExtendedData
  GenericData { price_map: PriceMap }
}

pub type OracleDatum {
  price_data: PriceData,
}

pub const price_key: Int = 0

pub const timestamp_key: Int = 1

pub const expiry_key: Int = 2

fn lookup(price_data: PriceData, key: Int) -> Int {
  when price_data is {
    GenericData { price_map } -> {
      expect Some(value) = pairs.get_first(price_map, key)
      value
    }
    _ -> fail @"Oracle datum is not GenericData"
  }
}

pub fn price_of(datum: OracleDatum) -> Int {
  lookup(datum.price_data, price_key)
}

pub fn timestamp_of(datum: OracleDatum) -> Int {
  lookup(datum.price_data, timestamp_key)
}

pub fn expiry_of(datum: OracleDatum) -> Int {
  lookup(datum.price_data, expiry_key)
}

/// Locates the feed among the transaction's reference inputs.
///
/// The feed is identified by the NFT it carries, not by an address. An address
/// can be imitated; a token under a policy the oracle controls cannot. Anyone
/// can put a UTxO with a plausible-looking datum at a plausible-looking address,
/// so identifying the feed by its NFT is what stops a fake price being supplied
/// alongside a real transaction.
pub fn find_feed(
  reference_inputs: List<Input>,
  policy: PolicyId,
  name: AssetName,
) -> OracleDatum {
  expect Some(feed_input) =
    list.find(
      reference_inputs,
      fn(input) { quantity_of(input.output.value, policy, name) == 1 },
    )

  expect InlineDatum(raw) = feed_input.output.datum
  expect datum: OracleDatum = raw
  datum
}

/// A feed past its expiry is refused rather than used.
///
/// A stale price is worse than no price: it silently misprices a payout. The
/// validator would rather fail the transaction and have the resolver retry once
/// the feed updates.
pub fn is_fresh(datum: OracleDatum, upper_bound: Int) -> Bool {
  upper_bound <= expiry_of(datum)
}

/// Converts a USD-denominated reward into lovelace at the feed price.
///
/// `reward_usd_micro` is USD scaled by 1,000,000, so $50.00 is 50_000_000.
/// `price_scale` is the feed's own scaling factor, declared in the bounty datum
/// rather than assumed, so a feed that changes precision cannot silently change
/// what a bounty pays.
///
///   lovelace = reward_usd_micro * price_scale / price
///
/// Integer division floors, which rounds in the poster's favour by at most one
/// lovelace. That is deliberate: the alternative rounds against the party whose
/// funds are locked.
pub fn usd_to_lovelace(reward_usd_micro: Int, price_scale: Int, price: Int) -> Int {
  expect price > 0
  reward_usd_micro * price_scale / price
}
