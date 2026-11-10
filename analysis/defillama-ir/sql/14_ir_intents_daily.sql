WITH payload AS (SELECT json_parse(http_get('https://defillama.com/api/public/near/ecosystem')) AS body),
charts AS (SELECT metric, series_name, c FROM payload
CROSS JOIN UNNEST(ARRAY['volume_usd','fees_usd','swaps'],ARRAY['Daily Volume','Daily Fees','Daily Swaps'],ARRAY[json_extract(body,'$.intents.volumeChart'),json_extract(body,'$.intents.feesChart'),json_extract(body,'$.intents.activityChart')]) AS t(metric,series_name,c)),
points AS (
 SELECT CAST(element_at(CAST(json_extract(c,'$.dates') AS ARRAY(VARCHAR)), n) AS DATE) AS day,
 metric, CAST(json_extract_scalar(v,'$') AS DOUBLE) AS value
 FROM charts
 CROSS JOIN UNNEST(CAST(json_extract(c,'$.series') AS ARRAY(JSON))) AS s(series)
 CROSS JOIN UNNEST(CAST(json_extract(series,'$.data') AS ARRAY(JSON))) WITH ORDINALITY AS x(v,n)
 WHERE json_extract_scalar(series,'$.name')=series_name
), daily AS (
 SELECT day, max(CASE WHEN metric='volume_usd' THEN value END) AS volume_usd,
 max(CASE WHEN metric='fees_usd' THEN value END) AS fees_usd,
 max(CASE WHEN metric='swaps' THEN value END) AS swaps,
 count(*)-count(DISTINCT metric) AS duplicate_metric_rows
 FROM points WHERE day<current_date GROUP BY day
)
SELECT *,  current_timestamp AS retrieved_utc FROM daily ORDER BY day DESC
