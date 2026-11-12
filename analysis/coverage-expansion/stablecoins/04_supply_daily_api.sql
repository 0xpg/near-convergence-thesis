-- USD circulation is not additive with minted, bridged or unreleased series.
WITH source AS (SELECT json_parse(http_get('https://stablecoins.llama.fi/stablecoincharts/Near')) AS body),
points AS (SELECT point FROM source CROSS JOIN UNNEST(CAST(body AS array(json))) t(point))
SELECT from_unixtime(CAST(json_extract_scalar(point,'$.date') AS double)) AS day,
 CAST(json_extract_scalar(point,'$.totalCirculatingUSD.peggedUSD') AS double) AS circulating_usd,
 CAST(json_extract_scalar(point,'$.totalUnreleased.peggedUSD') AS double) AS unreleased_token_units,
 CAST(json_extract_scalar(point,'$.totalMintedUSD.peggedUSD') AS double) AS minted_usd,
 CAST(json_extract_scalar(point,'$.totalBridgedToUSD.peggedUSD') AS double) AS bridged_to_usd
FROM points ORDER BY 1
