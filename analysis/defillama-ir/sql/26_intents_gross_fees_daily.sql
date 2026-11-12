WITH params AS (
 SELECT CAST('{{start_date}}' AS date) AS start_day,
 least(CAST('{{end_date}}' AS date), current_date - interval '1' day) AS end_day
), points AS (
 SELECT try_cast(substr(CAST(date_at AS varchar), 1, 10) AS date) AS day,
 'protocol' AS component, try_cast(amount_fee AS double) AS fees_usd
 FROM dune.near.dataset_near_intents_protocol_fees
 UNION ALL
 SELECT try_cast(substr(CAST(date_at AS varchar), 1, 10) AS date) AS day,
 'affiliate' AS component, try_cast(fee AS double) AS fees_usd
 FROM dune.near.dataset_near_intents_fees
)
SELECT day, component, sum(fees_usd) AS reported_fees_usd, count(*) AS fee_rows,
 count_if(fees_usd IS NULL OR fees_usd < 0) AS invalid_rows,
 'Protocol and affiliate components follow provider adapter; disjoint-event validation pending' AS component_definition,
 current_timestamp AS retrieved_utc
FROM points CROSS JOIN params WHERE day BETWEEN start_day AND end_day
GROUP BY 1,2 ORDER BY 1,2
