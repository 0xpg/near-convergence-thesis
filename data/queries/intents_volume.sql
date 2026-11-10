WITH payload AS (SELECT json_parse(http_get('https://api.llama.fi/summary/dexs/near-intents')) AS body),
 daily AS (
 SELECT CAST(from_unixtime(CAST(json_extract_scalar(p,'$[0]') AS DOUBLE)) AS DATE) AS day,
 CAST(json_extract_scalar(p,'$[1]') AS DOUBLE) AS volume_usd
 FROM payload CROSS JOIN UNNEST(CAST(json_extract(body,'$.totalDataChart') AS ARRAY(JSON))) AS t(p)
 )
SELECT day,volume_usd FROM daily
WHERE day>=current_date-interval '365' day AND day<current_date ORDER BY day
