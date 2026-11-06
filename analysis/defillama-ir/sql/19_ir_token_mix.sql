-- Token and blockchain dimensions describe the same volume; never add them.
SELECT label, volume_usd, share_pct, period_start, period_end, observed_dates, retrieved_utc
FROM query_9077418
WHERE dimension = 'Token'
ORDER BY volume_usd DESC
