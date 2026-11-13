WITH v AS (
 SELECT day,sum(reported_volume_usd) AS volume_usd,
 sum(CASE WHEN source_type='public' THEN reported_volume_usd ELSE 0 END) AS public_volume_usd,
 sum(CASE WHEN source_type='confidential' THEN reported_volume_usd ELSE 0 END) AS confidential_volume_usd,
 sum(positive_tokens_unpriced_rows) AS unpriced_volume_rows,sum(invalid_numeric_rows) AS invalid_volume_rows
 FROM query_9115683 GROUP BY 1
), f AS (
 SELECT day,sum(reported_priced_fees_usd) AS fees_usd,
 sum(protocol_component_usd) AS protocol_fees_usd,
 sum(CASE WHEN source_type='public' THEN affiliate_component_usd ELSE 0 END) AS public_affiliate_fees_usd,
 sum(CASE WHEN source_type='confidential' THEN affiliate_component_usd ELSE 0 END) AS confidential_affiliate_fees_usd,
 sum(CASE WHEN source_type NOT IN ('public','confidential') THEN affiliate_component_usd ELSE 0 END) AS other_affiliate_fees_usd,
 sum(missing_fee_rows) AS missing_fee_rows,sum(invalid_numeric_rows) AS invalid_fee_rows
 FROM query_9117854 GROUP BY 1
), cutoff AS (
 SELECT least((SELECT max(day) FROM v),(SELECT max(day) FROM f),current_date-INTERVAL '1' DAY) AS end_day
), days AS (
 SELECT d FROM cutoff CROSS JOIN UNNEST(sequence(end_day-INTERVAL '89' DAY,end_day,INTERVAL '1' DAY)) t(d)
)
SELECT d AS day,v.volume_usd,v.public_volume_usd,v.confidential_volume_usd,
 f.fees_usd,f.protocol_fees_usd,f.public_affiliate_fees_usd,f.confidential_affiliate_fees_usd,f.other_affiliate_fees_usd,
 v.unpriced_volume_rows,v.invalid_volume_rows,f.missing_fee_rows,f.invalid_fee_rows,
 'Provider reporting classes, not matched swap cohorts. Protocol fee privacy remains unattributed. Missing fees are unknown; price/leg accounting follows source.' AS interpretation,
 current_timestamp AS retrieved_utc
FROM days LEFT JOIN v ON v.day=days.d LEFT JOIN f ON f.day=days.d ORDER BY day
