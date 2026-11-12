WITH params AS (
 SELECT CAST('{{start_date}}' AS date) AS start_day,
 least(CAST('{{end_date}}' AS date), current_date - interval '1' day) AS end_day
), wallets(wallet) AS (VALUES
 ('fefundsadmin.sputnik-dao.near'), ('1csfundsadmin.sputnik-dao.near'), ('buybacks.multisignature.near')
), candidates AS (
 SELECT block_date AS day, receipt_receiver_account_id AS wallet, 'native_NEAR' AS asset,
 CAST(action_transfer_deposit AS double) / 1e24 AS amount_near
 FROM near.actions CROSS JOIN params
 WHERE block_date BETWEEN start_day AND end_day
 AND action_kind = 'TRANSFER' AND execution_status = 'SUCCESS_VALUE'
 AND receipt_receiver_account_id IN (SELECT wallet FROM wallets)
 AND receipt_predecessor_account_id NOT IN (SELECT wallet FROM wallets)
 UNION ALL
 SELECT block_date AS day, affected_account_id AS wallet, 'wNEAR' AS asset,
 CAST(delta_amount AS double) / 1e24 AS amount_near
 FROM near.ft_transfers CROSS JOIN params
 WHERE block_date BETWEEN start_day AND end_day
 AND contract_account_id = 'wrap.near' AND delta_amount > 0
 AND affected_account_id IN (SELECT wallet FROM wallets)
 AND (involved_account_id IS NULL OR involved_account_id NOT IN (SELECT wallet FROM wallets))
)
SELECT day, wallet, asset, sum(amount_near) AS candidate_inflow_near, count(*) AS event_rows,
 'External successful wallet inflows, excluding named inter-wallet hops; not executed purchases or burns' AS interpretation,
 'Native and wrapped series kept separate until wrap/unwrap and event-key audit' AS accounting_status,
 current_timestamp AS retrieved_utc
FROM candidates GROUP BY 1,2,3 ORDER BY 1,2,3
