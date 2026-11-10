WITH tx AS (
 SELECT block_date,tx_hash,max(tx_from) AS origin,
  max(CASE WHEN action_kind='DELEGATE_ACTION' OR is_delegate_action THEN 1 ELSE 0 END) AS delegated,
  count(DISTINCT tx_from) AS origin_variants
 FROM near.actions
 WHERE block_date>=current_date-interval '7' day AND block_date<current_date
  AND tx_hash IS NOT NULL
 GROUP BY 1,2
), daily AS (
 SELECT block_date,count(*) AS observed_transactions,
  count(DISTINCT origin) AS transaction_origin_accounts,
  sum(delegated) AS delegated_transactions,
  count_if(origin IS NULL) AS missing_origin_transactions,
  count_if(origin_variants>1) AS inconsistent_origin_transactions
 FROM tx GROUP BY 1
)
SELECT *,
 max(block_date) OVER () AS latest_observed_date,
 count(*) OVER () AS observed_dates,
 CASE WHEN count(*) OVER ()=7 THEN avg(observed_transactions) OVER () END AS avg_daily_observed_transactions_7d,
 CASE WHEN count(*) OVER ()=7 THEN avg(transaction_origin_accounts) OVER () END AS avg_daily_origin_accounts_7d
FROM daily ORDER BY block_date;
