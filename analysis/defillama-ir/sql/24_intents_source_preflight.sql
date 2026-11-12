WITH metrics AS (
 SELECT try_cast(substr(CAST(date_at AS varchar), 1, 10) AS date) AS day,
 CAST(blockchain AS varchar) AS blockchain, CAST(symbol AS varchar) AS symbol,
 CAST(source_type AS varchar) AS source_type, try_cast(volume_amount_usd AS double) AS amount
 FROM dune.near.dataset_near_intents_metrics
), protocol_fees AS (
 SELECT try_cast(substr(CAST(date_at AS varchar), 1, 10) AS date) AS day, try_cast(amount_fee AS double) AS amount
 FROM dune.near.dataset_near_intents_protocol_fees
), affiliate_fees AS (
 SELECT try_cast(substr(CAST(date_at AS varchar), 1, 10) AS date) AS day, try_cast(fee AS double) AS amount
 FROM dune.near.dataset_near_intents_fees
)
SELECT 'metrics' AS dataset, min(day) AS first_day, max(day) AS last_day,
 count(*) AS rows_seen, count_if(day IS NULL OR amount IS NULL OR amount < 0) AS invalid_rows,
 count_if(day IS NULL) AS invalid_date_rows, count_if(amount IS NULL) AS missing_amount_rows, count_if(amount < 0) AS negative_amount_rows,
 count(DISTINCT source_type) AS source_type_labels, array_agg(DISTINCT source_type) AS labels
FROM metrics
UNION ALL
SELECT 'protocol_fees', min(day), max(day), count(*), count_if(day IS NULL OR amount IS NULL OR amount < 0), count_if(day IS NULL), count_if(amount IS NULL), count_if(amount < 0), NULL, CAST(NULL AS array(varchar))
FROM protocol_fees
UNION ALL
SELECT 'affiliate_fees', min(day), max(day), count(*), count_if(day IS NULL OR amount IS NULL OR amount < 0), count_if(day IS NULL), count_if(amount IS NULL), count_if(amount < 0), NULL, CAST(NULL AS array(varchar))
FROM affiliate_fees
