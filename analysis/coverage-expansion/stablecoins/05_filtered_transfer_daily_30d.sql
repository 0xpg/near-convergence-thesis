WITH roster(contract,symbol,representation,decimals) AS (VALUES
('17208628f84f5d6ad33f0da3bbbeb27ffcb398eac501a31bd6ad2011e36133a1','USDC','native_issuer',6),
('eth-0xdac17f958d2ee523a2206206994597c13d831ec7.omft.near','USDT','omni_bridge_representation',6),
('eth-0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48.omft.near','USDC','omni_bridge_representation',6),
('tron-d28a265909efecdcee7c5028585214ea0b96f015.omft.near','USDT','omni_bridge_representation',6),
('sol-c800a4bd850783ccb82c2b2c7e84175443606352.omft.near','USDT','omni_bridge_representation',6),
('usdt.tether-token.near','USDT','native_issuer',6),
('arb-0xaf88d065e77c8cc2239327c5edb3a432268e5831.omft.near','USDC','omni_bridge_representation',6),
('base-0x833589fcd6edb6e08f4c7c32d4f71b54bda02913.omft.near','USDC','omni_bridge_representation',6),
('sol-5ce3bf3a31af18be40ba30f721101b4341690186.omft.near','USDC','omni_bridge_representation',6),
('gnosis-0x2a22f9c3b484c3629090feed35f17ff8f88f76f0.omft.near','USDC','omni_bridge_representation',6),
('gnosis-0x4ecaba5870353805a9f068101a40e0f32ed605c6.omft.near','USDT','omni_bridge_representation',6),
('aptos-88cb7619440a914fe6400149a12b443c3ac21d59.omft.near','USDT','omni_bridge_representation',6),
('aptos-34ee497f210c5a511e8d5b53bc56d75b63612bb5.omft.near','USDC','omni_bridge_representation',6),
('sui-c1b81ecaf27933252d31a963bc5e9458f13c18ce.omft.near','USDC','omni_bridge_representation',6),
('miden-0x5cb79d29507d3ad17bb6dc60279e89.omft.near','USDT','omni_bridge_representation',6),
('a0b86991c6218b36c1d19d4a2e9eb0ce3606eb48.factory.bridge.near','USDC.e','rainbow_bridge_representation',6),
('dac17f958d2ee523a2206206994597c13d831ec7.factory.bridge.near','USDT.e','rainbow_bridge_representation',6)
), scoped AS (SELECT f.*,r.symbol,r.representation,r.decimals FROM near.ft_transfers f JOIN roster r ON f.contract_account_id=r.contract WHERE block_date>=current_date-interval '30' day AND block_date<current_date), keyed AS (
 SELECT *,count(*) OVER(PARTITION BY receipt_id,event_index,contract_account_id,affected_account_id,involved_account_id,delta_amount) AS multiplicity
 FROM scoped WHERE delta_amount>0 AND lower(cause)='ft_transfer' AND status LIKE 'SUCCESS%'
 AND affected_account_id IS NOT NULL AND involved_account_id IS NOT NULL AND affected_account_id<>involved_account_id
), price_points AS (
 SELECT try_cast(substr(CAST(date_at AS varchar),1,10) AS date) AS day,token_id,CAST(price AS varchar) AS raw_price,try_cast(price AS double) AS price
 FROM dune.near.dataset_near_intents_metrics
 WHERE try_cast(substr(CAST(date_at AS varchar),1,10) AS date)>=current_date-interval '30' day
 AND try_cast(substr(CAST(date_at AS varchar),1,10) AS date)<current_date
), prices AS (
 SELECT day,token_id,CASE WHEN count(DISTINCT CASE WHEN price>0 AND is_finite(price) THEN price END)=1 AND count_if(raw_price IS NOT NULL AND (price IS NULL OR NOT is_finite(price) OR price<=0))=0 THEN max(CASE WHEN price>0 AND is_finite(price) THEN price END) END AS price_usd
 FROM price_points GROUP BY day,token_id
), marked AS (
 SELECT k.*,p.price_usd,CAST(delta_amount AS double)/pow(10,decimals) AS token_units
 FROM keyed k LEFT JOIN prices p ON p.day=k.block_date AND p.token_id=concat('nep141:',k.contract_account_id)
)
SELECT block_date AS day,concat(symbol,' · ',representation) AS series,symbol,representation,
 count(*) AS positive_transfer_legs,
 count_if(multiplicity>1 OR receipt_id IS NULL OR event_index IS NULL) AS ambiguous_legs,
 count_if(price_usd IS NULL) AS unpriced_legs,
 CASE WHEN count_if(multiplicity>1 OR receipt_id IS NULL OR event_index IS NULL)=0 THEN sum(token_units) END AS gross_token_units,
 CASE WHEN count_if(multiplicity>1 OR receipt_id IS NULL OR event_index IS NULL)=0 AND count_if(price_usd IS NULL)=0 THEN sum(token_units*price_usd) END AS fully_priced_gross_usd,
 sum(CASE WHEN price_usd IS NOT NULL THEN token_units*price_usd END) AS diagnostic_priced_subset_usd,
 CASE WHEN count_if(multiplicity>1 OR receipt_id IS NULL OR event_index IS NULL)=0 THEN sum(CASE WHEN affected_account_id='intents.near' OR involved_account_id='intents.near' THEN token_units ELSE 0 END) END AS direct_intents_custody_units,
 '17-contract current roster; one positive leg; ft_transfer and successful receipt; no self transfers or mint/burn. Gross movement includes refunds/custody, not payments or net inflows. Daily provider price marks, not trade prices; incomplete groups withheld.' AS definition,
 current_timestamp AS retrieved_utc
FROM marked GROUP BY 1,2,3,4 ORDER BY day,series
