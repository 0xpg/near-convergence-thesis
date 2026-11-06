-- One unit and source window: provider accounting mix over the last 12 months.
SELECT label, value AS revenue_near, share_pct, period, retrieved_utc
FROM query_9077421
WHERE section = 'Revenue wallets'
ORDER BY revenue_near DESC
