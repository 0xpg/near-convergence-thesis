WITH payloads AS (
 SELECT label,json_parse(http_get(url)) AS body
 FROM (VALUES
 ('ALL','https://stablecoins.llama.fi/stablecoincharts/Near'),
 ('USDT','https://stablecoins.llama.fi/stablecoincharts/Near?stablecoin=1'),
 ('USDC','https://stablecoins.llama.fi/stablecoincharts/Near?stablecoin=2')
 ) AS t(label,url)
), points AS (
 SELECT label,CAST(from_unixtime(try_cast(json_extract_scalar(point,'$.date') AS double)) AS date) AS day,
 try_cast(json_extract_scalar(point,'$.totalCirculatingUSD.peggedUSD') AS double) AS circulating_usd,
 try_cast(json_extract_scalar(point,'$.totalUnreleased.peggedUSD') AS double) AS unreleased_units
 FROM payloads CROSS JOIN UNNEST(CAST(body AS array(json))) AS t(point)
), daily AS (
 SELECT day,
 max(CASE WHEN label='ALL' THEN circulating_usd END) AS total_usd,
 max(CASE WHEN label='USDT' THEN circulating_usd END) AS usdt_usd,
 max(CASE WHEN label='USDC' THEN circulating_usd END) AS usdc_usd,
 max(CASE WHEN label='ALL' THEN unreleased_units END) AS issuer_unreleased_nominal_units,
 count(*)-count(DISTINCT label) AS duplicate_source_dates,
 count_if(circulating_usd IS NULL OR NOT is_finite(circulating_usd) OR circulating_usd<0) AS invalid_points
 FROM points WHERE day<current_date GROUP BY day
), checked AS (
 SELECT *,duplicate_source_dates=0 AND invalid_points=0 AND total_usd IS NOT NULL AS total_valid,
 duplicate_source_dates=0 AND invalid_points=0 AND usdt_usd IS NOT NULL AND usdc_usd IS NOT NULL
 AND usdt_usd+usdc_usd<=total_usd AS split_valid
 FROM daily
)
SELECT day,t.series,t.value_usd,total_usd AS circulating_total_usd,issuer_unreleased_nominal_units,
 duplicate_source_dates,invalid_points,split_valid,
 'Provider circulating USD value only; issuer unreleased reserves excluded. Token labels combine provider representations; native/bridged contract split not established. Unknown category history remains unsplit; balance changes are not net deposits.' AS definition,
 current_timestamp AS retrieved_utc
FROM checked CROSS JOIN UNNEST(
 ARRAY['USDT','USDC','Other circulating assets','Unsplit circulation'],
 ARRAY[CASE WHEN split_valid THEN usdt_usd END,CASE WHEN split_valid THEN usdc_usd END,
 CASE WHEN split_valid THEN total_usd-usdt_usd-usdc_usd END,
 CASE WHEN total_valid AND NOT split_valid THEN total_usd END]
) AS t(series,value_usd)
ORDER BY day,series
