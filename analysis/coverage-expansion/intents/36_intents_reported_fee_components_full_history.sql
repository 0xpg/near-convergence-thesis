WITH raw AS (
 SELECT try_cast(substr(CAST(date_at AS varchar), 1, 10) AS date) AS day,
 'protocol' AS component, 'unattributed_protocol' AS source_type,
 'public' AS official_source_type,
 CAST(amount_fee AS varchar) AS raw_fee, try_cast(amount_fee AS double) AS fees_usd
 FROM dune.near.dataset_near_intents_protocol_fees
 UNION ALL
 SELECT try_cast(substr(CAST(date_at AS varchar), 1, 10) AS date) AS day,
 'affiliate' AS component,
 coalesce(nullif(lower(trim(CAST(source_type AS varchar))), ''), 'unknown') AS source_type,
 coalesce(nullif(lower(trim(CAST(source_type AS varchar))), ''), 'unknown') AS official_source_type,
 CAST(fee AS varchar) AS raw_fee, try_cast(fee AS double) AS fees_usd
 FROM dune.near.dataset_near_intents_fees
), classified AS (
 SELECT *, raw_fee IS NOT NULL AND
 (fees_usd IS NULL OR NOT is_finite(fees_usd) OR fees_usd < 0) AS invalid_numeric,
 fees_usd IS NOT NULL AND is_finite(fees_usd) AND fees_usd >= 0 AS valid_numeric
 FROM raw WHERE day < current_date
)
SELECT day, official_source_type AS source_type,
 sum(CASE WHEN valid_numeric THEN fees_usd END) AS reported_priced_fees_usd,
 sum(CASE WHEN component='protocol' AND valid_numeric THEN fees_usd END) AS protocol_component_usd,
 sum(CASE WHEN component='affiliate' AND valid_numeric THEN fees_usd END) AS affiliate_component_usd,
 count(*) AS source_rows, count_if(raw_fee IS NULL) AS missing_fee_rows,
 count_if(invalid_numeric) AS invalid_numeric_rows,
 count_if(valid_numeric) AS valid_fee_rows,
 'Provider adapter fee components; event disjointness not independently verified; not cash receipts, executed buybacks or burns' AS interpretation,
 'Official query6162606 classifies all protocol fees as public by a SQL literal; raw protocol privacy attribution is not established. Affiliate classification follows its source field.' AS privacy_scope,
 current_timestamp AS retrieved_utc
FROM classified GROUP BY 1,2 ORDER BY 1,2
