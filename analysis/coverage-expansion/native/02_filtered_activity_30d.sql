WITH hashes AS (
 SELECT block_date AS day,tx_hash,max(tx_from) AS originator,count(DISTINCT tx_from) AS originator_labels,
 bool_or(execution_status LIKE 'SUCCESS%') AS has_successful_receipt,bool_or(execution_status='FAILURE') AS has_failed_receipt,
 count(*) AS action_rows,count(DISTINCT receipt_id) AS receipt_count
 FROM near.actions WHERE block_date>=current_date-interval '30' day AND block_date<current_date
 AND tx_status LIKE 'SUCCESS%' GROUP BY 1,2
)
SELECT day,count_if(tx_hash IS NOT NULL AND has_successful_receipt) AS successful_execution_hashes,
 count(DISTINCT CASE WHEN tx_hash IS NOT NULL AND has_successful_receipt AND originator_labels=1 THEN originator END) AS active_originating_accounts,
 count_if(tx_hash IS NOT NULL AND has_failed_receipt) AS hashes_with_failed_receipts,
 count_if(tx_hash IS NOT NULL AND has_successful_receipt AND has_failed_receipt) AS mixed_outcome_hashes,
 sum(action_rows) AS accepted_parent_action_rows,sum(receipt_count) AS observed_receipts,
 count_if(tx_hash IS NULL) AS missing_hash_groups,count_if(originator_labels<>1) AS inconsistent_originator_groups,
 'Execution-day distinct hashes with a successful receipt under accepted parent status. Not final transaction success; daily hashes can recur across days. Originators are accounts, not people.' AS definition,current_timestamp AS retrieved_utc
FROM hashes GROUP BY day ORDER BY day
