-- Public DefiLlama NEAR investor-relations feed; provider-reported, not independent verification.
-- Array position joins each value to its own chart date. Missing values remain NULL.
-- Excludes the current UTC date. Never sum daily counts into unique users.
WITH payload AS (SELECT json_parse(http_get('https://defillama.com/api/public/near/ecosystem')) AS body),
charts AS (SELECT metric, series_name, c FROM payload
CROSS JOIN UNNEST(ARRAY['transactions','active_accounts','new_accounts','gas_fees_near','price_usd','total_supply_near','circulating_supply_near'],ARRAY['Transactions','Active Accounts','New Accounts','Gas Fees','Price','Total Supply','Circulating Supply'],ARRAY[json_extract(body,'$.ecosystem.txnsChart'),json_extract(body,'$.ecosystem.activeAccountsChart'),json_extract(body,'$.ecosystem.newAccountsChart'),json_extract(body,'$.ecosystem.gasChart'),json_extract(body,'$.tokenEconomics.priceChart'),json_extract(body,'$.tokenEconomics.supplyChart'),json_extract(body,'$.tokenEconomics.supplyChart')]) AS t(metric,series_name,c)),
points AS (
 SELECT CAST(element_at(CAST(json_extract(c,'$.dates') AS ARRAY(VARCHAR)), n) AS DATE) AS day,
 metric, CAST(json_extract_scalar(v,'$') AS DOUBLE) AS value
 FROM charts
 CROSS JOIN UNNEST(CAST(json_extract(c,'$.series') AS ARRAY(JSON))) AS s(series)
 CROSS JOIN UNNEST(CAST(json_extract(series,'$.data') AS ARRAY(JSON))) WITH ORDINALITY AS x(v,n)
 WHERE json_extract_scalar(series,'$.name')=series_name
), daily AS (
 SELECT day, max(CASE WHEN metric='transactions' THEN value END) AS transactions,
 max(CASE WHEN metric='active_accounts' THEN value END) AS active_accounts,
 max(CASE WHEN metric='new_accounts' THEN value END) AS new_accounts,
 max(CASE WHEN metric='gas_fees_near' THEN value END) AS gas_fees_near,
 max(CASE WHEN metric='price_usd' THEN value END) AS price_usd,
 max(CASE WHEN metric='total_supply_near' THEN value END) AS total_supply_near,
 max(CASE WHEN metric='circulating_supply_near' THEN value END) AS circulating_supply_near,
 count(*)-count(DISTINCT metric) AS duplicate_metric_rows
 FROM points WHERE day<current_date GROUP BY day
)
SELECT *,  current_timestamp AS retrieved_utc FROM daily ORDER BY day DESC
