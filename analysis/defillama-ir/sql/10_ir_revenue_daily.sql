WITH payload AS (SELECT json_parse(http_get('https://defillama.com/api/public/near/revenue')) AS body),
charts AS (SELECT metric, series_name, c FROM payload
CROSS JOIN UNNEST(ARRAY['intents_fees_near','protocol_fees_near','intents_revenue_near','provider_burn_revenue_near','emissions_near'],ARRAY['Intent Fees','Protocol Fees','Intents Revenue','Protocol Revenue (70% Burned)','Daily Emissions'],ARRAY[json_extract(body,'$.fees.feesChart'),json_extract(body,'$.fees.feesChart'),json_extract(body,'$.revenue.revenueChart'),json_extract(body,'$.revenue.revenueChart'),json_extract(body,'$.emissions.revenueVsEmissionsChart')]) AS t(metric,series_name,c)),
points AS (
 SELECT CAST(element_at(CAST(json_extract(c,'$.dates') AS ARRAY(VARCHAR)), n) AS DATE) AS day,
 metric, CAST(json_extract_scalar(v,'$') AS DOUBLE) AS value
 FROM charts
 CROSS JOIN UNNEST(CAST(json_extract(c,'$.series') AS ARRAY(JSON))) AS s(series)
 CROSS JOIN UNNEST(CAST(json_extract(series,'$.data') AS ARRAY(JSON))) WITH ORDINALITY AS x(v,n)
 WHERE json_extract_scalar(series,'$.name')=series_name
), daily AS (
 SELECT day, max(CASE WHEN metric='intents_fees_near' THEN value END) AS intents_fees_near,
 max(CASE WHEN metric='protocol_fees_near' THEN value END) AS protocol_fees_near,
 max(CASE WHEN metric='intents_revenue_near' THEN value END) AS intents_revenue_near,
 max(CASE WHEN metric='provider_burn_revenue_near' THEN value END) AS provider_burn_revenue_near,
 max(CASE WHEN metric='emissions_near' THEN value END) AS emissions_near,
 count(*)-count(DISTINCT metric) AS duplicate_metric_rows
 FROM points WHERE day<current_date GROUP BY day
)
SELECT *, intents_fees_near+protocol_fees_near AS total_fees_near,
 intents_revenue_near+provider_burn_revenue_near AS total_revenue_near,
 sum(intents_fees_near+protocol_fees_near) OVER (ORDER BY day) AS cumulative_fees_near,
 sum(intents_revenue_near+provider_burn_revenue_near) OVER (ORDER BY day) AS cumulative_revenue_near,
 100*(intents_revenue_near+provider_burn_revenue_near)/nullif(emissions_near,0) AS revenue_pct_emissions, current_timestamp AS retrieved_utc FROM daily ORDER BY day DESC
