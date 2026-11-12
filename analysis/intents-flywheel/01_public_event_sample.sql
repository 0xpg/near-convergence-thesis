SELECT block_date, block_time, receipt_id, index_in_execution_outcome_logs,
 execution_status, event
FROM near.logs
WHERE executor_account_id='intents.near'
 AND block_date >= current_date - INTERVAL '2' DAY
 AND block_date < current_date
 AND execution_status LIKE 'SUCCESS%'
 AND event LIKE '%"token_diff"%'
ORDER BY block_time DESC
LIMIT 8
