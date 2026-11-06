-- Last 30 available source dates, not necessarily the last 30 calendar dates.
SELECT label, volume_usd, share_pct, period_start, period_end, observed_dates, retrieved_utc
FROM query_9077418
WHERE dimension = 'Blockchain'
ORDER BY volume_usd DESC
