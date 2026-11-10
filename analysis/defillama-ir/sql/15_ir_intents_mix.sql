WITH payload AS (SELECT json_parse(http_get('https://defillama.com/api/public/near/ecosystem')) AS body),
charts AS (SELECT dimension,c FROM payload CROSS JOIN UNNEST(
 ARRAY['Token','Blockchain'],
 ARRAY[json_extract(body,'$.intents.tokenBreakdown'),json_extract(body,'$.intents.blockchainBreakdown')]
) AS t(dimension,c)), points AS (
 SELECT dimension,json_extract_scalar(series,'$.name') AS label,
 CAST(element_at(CAST(json_extract(c,'$.dates') AS ARRAY(VARCHAR)), n) AS DATE) AS day,
 CAST(json_extract_scalar(v,'$') AS DOUBLE) AS volume_usd
 FROM charts CROSS JOIN UNNEST(CAST(json_extract(c,'$.series') AS ARRAY(JSON))) AS s(series)
 CROSS JOIN UNNEST(CAST(json_extract(series,'$.data') AS ARRAY(JSON))) WITH ORDINALITY AS x(v,n)
), dated AS (SELECT *,max(day) OVER (PARTITION BY dimension) AS period_end
 FROM points WHERE day<current_date), totals AS (
 SELECT dimension,label,period_end,min(day) AS period_start,count(DISTINCT day) AS observed_dates,
 sum(volume_usd) AS volume_usd FROM dated
 WHERE day>=period_end-interval '29' day GROUP BY 1,2,3
)
SELECT *,100*volume_usd/nullif(sum(volume_usd) OVER (PARTITION BY dimension),0) AS share_pct,
current_timestamp AS retrieved_utc FROM totals ORDER BY dimension,volume_usd DESC
