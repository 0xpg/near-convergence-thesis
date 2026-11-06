-- All-time channel fees in USD; not interchangeable with total Intents fees.
SELECT label, value AS fees_usd, share_pct, period, retrieved_utc
FROM query_9077421
WHERE section = 'Reported fee channels'
ORDER BY fees_usd DESC
