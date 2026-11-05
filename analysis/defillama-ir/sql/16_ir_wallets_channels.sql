-- Separate source scopes and units; never add these two groups together.
-- Wallet window is provider-defined last 12 months. Channel fees are all-time.
WITH r AS (SELECT json_parse(http_get('https://defillama.com/api/public/near/revenue')) AS body),
e AS (SELECT json_parse(http_get('https://defillama.com/api/public/near/ecosystem')) AS body), rows AS (
 SELECT 'Revenue wallets' AS section,json_extract_scalar(w,'$.wallet') AS label,
 CAST(json_extract_scalar(w,'$.total') AS DOUBLE) AS value,'NEAR' AS unit,
 100*CAST(json_extract_scalar(w,'$.total') AS DOUBLE)/nullif(CAST(json_extract_scalar(body,'$.revenue.walletBreakdown.total') AS DOUBLE),0) AS share_pct,
 'Last 12 months (provider window)' AS period
 FROM r CROSS JOIN UNNEST(CAST(json_extract(body,'$.revenue.walletBreakdown.wallets') AS ARRAY(JSON))) AS t(w)
 UNION ALL
 SELECT 'Reported fee channels',json_extract_scalar(c,'$.referral'),
 CAST(json_extract_scalar(c,'$.fees') AS DOUBLE),'USD',
 CAST(json_extract_scalar(c,'$.sharePct') AS DOUBLE),'All-time (provider window)'
 FROM e CROSS JOIN UNNEST(CAST(json_extract(body,'$.intents.channelBreakdown.channels') AS ARRAY(JSON))) AS t(c)
)
SELECT *,current_timestamp AS retrieved_utc FROM rows ORDER BY section,value DESC
