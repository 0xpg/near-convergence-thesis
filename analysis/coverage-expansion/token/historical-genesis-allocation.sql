-- Historical announced genesis allocation; not current ownership or 2035 supply.
-- Primary project context: https://www.near.org/blog/near-token-supply-and-distribution
-- Numeric corroboration: Bitstamp, 2024-07-29, Token supply section:
-- https://www.bitstamp.net/en-gb/learn/cryptocurrency-guide/what-is-near-protocol-near/
-- Combined backers independently corroborated by Kraken's 2025-08-19 asset statement.
-- Original project allocation image could not be inspected in this review.
-- Seven categories intentionally combine small and large backers rather than invent split.
WITH allocation(category, genesis_near) AS (VALUES
 ('Community grants and programs', 172000000),
 ('Project backers', 237000000),
 ('Core contributors', 140000000),
 ('Community sale', 120000000),
 ('Early ecosystem', 117000000),
 ('Operations grants', 114000000),
 ('Foundation endowment', 100000000)
)
SELECT category, genesis_near,
 100.0 * genesis_near / sum(genesis_near) OVER () AS genesis_share_pct,
 DATE '2020-04-22' AS genesis_date,
 DATE '2020-10-13' AS scheduled_unlock_start,
 'Historical announced genesis allocation; not current ownership' AS measurement
FROM allocation ORDER BY genesis_near DESC
