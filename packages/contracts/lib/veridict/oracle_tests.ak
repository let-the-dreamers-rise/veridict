use veridict/oracle.{
  GenericData, OracleDatum, SharedData, expiry_of, is_fresh, price_of, timestamp_of,
  usd_to_lovelace,
}

/// The feed scales its price by one million, so 0.50 USD per ADA is 500_000.
const scale: Int = 1_000_000

fn feed(price: Int, timestamp: Int, expiry: Int) -> OracleDatum {
  OracleDatum {
    price_data: GenericData {
      price_map: [Pair(0, price), Pair(1, timestamp), Pair(2, expiry)],
    },
  }
}

test reads_price_timestamp_and_expiry_by_key() {
  let sample = feed(500_000, 1_700_000_000_000, 1_700_000_600_000)
  and {
    price_of(sample) == 500_000,
    timestamp_of(sample) == 1_700_000_000_000,
    expiry_of(sample) == 1_700_000_600_000,
  }
}

test fifty_dollars_at_fifty_cents_is_one_hundred_ada() {
  usd_to_lovelace(50_000_000, scale, 500_000) == 100_000_000
}

test fifty_dollars_at_one_dollar_is_fifty_ada() {
  usd_to_lovelace(50_000_000, scale, 1_000_000) == 50_000_000
}

test a_falling_ada_price_requires_more_lovelace() {
  let at_fifty_cents = usd_to_lovelace(50_000_000, scale, 500_000)
  let at_twenty_five_cents = usd_to_lovelace(50_000_000, scale, 250_000)
  at_twenty_five_cents > at_fifty_cents
}

test a_rising_ada_price_requires_less_lovelace() {
  let at_fifty_cents = usd_to_lovelace(50_000_000, scale, 500_000)
  let at_two_dollars = usd_to_lovelace(50_000_000, scale, 2_000_000)
  at_two_dollars < at_fifty_cents
}

test rounding_never_exceeds_one_lovelace() {
  // Integer division floors, so the result is at most one lovelace under the
  // exact value. It must never round up, which would pay out more than the
  // bounty is denominated in.
  let exact = 3 * 1_000_000 * scale / 700_000
  usd_to_lovelace(3_000_000, scale, 700_000) <= exact
}

test a_feed_inside_its_expiry_is_fresh() {
  is_fresh(feed(500_000, 1_700_000_000_000, 1_700_000_600_000), 1_700_000_300_000)
}

test a_feed_past_its_expiry_is_not_fresh() {
  !is_fresh(feed(500_000, 1_700_000_000_000, 1_700_000_600_000), 1_700_000_900_000)
}

test expiry_boundary_counts_as_fresh() {
  is_fresh(feed(500_000, 1_700_000_000_000, 1_700_000_600_000), 1_700_000_600_000)
}

test a_non_generic_datum_is_rejected() fail {
  // Reading a price from a datum shape we do not understand must abort the
  // transaction rather than return a default that would misprice a payout.
  let invalid = OracleDatum { price_data: SharedData }
  is_fresh(invalid, 0)
}
