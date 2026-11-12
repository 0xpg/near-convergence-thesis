-- Public account-side token_diff activity only; not unique user swaps or verified solvers.
-- Thirty completed event days ending at latest eligible public event within a bounded 90-day scan.
-- Every repeated raw key or intent hash is withheld, including legitimate repeated multi-statement hashes.
-- DECIMAL(38,0) validation is conservative: valid signed-i128 values beyond 38 digits are withheld.
-- Unlike the local adapter, SQL quarantines every repeated key/hash, including byte-identical duplicates.
-- Confidential execution is absent. Registry chain labels describe representations, not funding routes.
WITH raw AS (
 SELECT block_date AS day, block_time, receipt_id, index_in_execution_outcome_logs AS log_index,
  event, try(json_parse(event)) AS parsed,
  count(*) OVER(PARTITION BY receipt_id,index_in_execution_outcome_logs) AS raw_key_rows
 FROM near.logs
 WHERE executor_account_id='intents.near' AND execution_status LIKE 'SUCCESS%'
 AND block_date >= current_date - INTERVAL '90' DAY AND block_date < current_date
), typed AS (
 SELECT *,try(CAST(json_extract(parsed,'$.data') AS array(json))) AS payloads
 FROM raw WHERE json_extract_scalar(parsed,'$.standard')='dip4'
 AND json_extract_scalar(parsed,'$.event')='token_diff'
), cutoff AS (
 SELECT max(day) AS end_day FROM typed WHERE cardinality(payloads)>0
), in_window AS (
 SELECT t.* FROM typed t CROSS JOIN cutoff c WHERE t.day BETWEEN c.end_day-INTERVAL '29' DAY AND c.end_day
), expanded AS (
 SELECT w.*,ordinal,json_extract_scalar(p,'$.account_id') AS account_id,
  json_extract_scalar(p,'$.intent_hash') AS intent_hash,
  nullif(trim(json_extract_scalar(p,'$.referral')),'') AS referral,
  try(CAST(json_extract(p,'$.diff') AS map(varchar,varchar))) AS deltas,
  json_extract(p,'$.fees_collected') IS NOT NULL AS fees_field_present,
  try(CAST(json_extract(p,'$.fees_collected') AS map(varchar,varchar))) AS fees_map
 FROM in_window w CROSS JOIN UNNEST(w.payloads) WITH ORDINALITY AS u(p,ordinal)
), keyed AS (
 SELECT *,count(*) OVER(PARTITION BY intent_hash) AS intent_hash_rows
 FROM expanded
), profiled AS (
 SELECT k.*,
  cardinality(filter(map_values(deltas),v->regexp_like(v,'^-?[0-9]+$') AND try_cast(v AS decimal(38,0))<0)) AS negative_assets,
  cardinality(filter(map_values(deltas),v->regexp_like(v,'^-?[0-9]+$') AND try_cast(v AS decimal(38,0))>0)) AS positive_assets,
  cardinality(filter(map_values(deltas),v->v IS NULL OR NOT regexp_like(v,'^-?[0-9]+$') OR try_cast(v AS decimal(38,0)) IS NULL OR try_cast(v AS decimal(38,0))=0)) AS invalid_amounts,
  cardinality(filter(map_keys(deltas),a->a IS NULL OR trim(a)='')) AS invalid_token_keys,
  element_at(map_keys(map_filter(deltas,(a,v)->regexp_like(v,'^-?[0-9]+$') AND try_cast(v AS decimal(38,0))<0)),1) AS input_asset,
  element_at(map_keys(map_filter(deltas,(a,v)->regexp_like(v,'^-?[0-9]+$') AND try_cast(v AS decimal(38,0))>0)),1) AS output_asset
 FROM keyed k
), canonical AS (
 SELECT *,negative_assets=1 AND positive_assets=1 AS simple_pair,
  cardinality(fees_map)>0 AS nonempty_fee_map
 FROM profiled WHERE receipt_id IS NOT NULL AND trim(receipt_id)<>'' AND log_index IS NOT NULL
 AND raw_key_rows=1 AND intent_hash_rows=1
 AND nullif(trim(account_id),'') IS NOT NULL AND nullif(trim(intent_hash),'') IS NOT NULL
 AND deltas IS NOT NULL AND cardinality(deltas)>0 AND invalid_amounts=0 AND invalid_token_keys=0
), raw_audit AS (
 SELECT day,count(*) AS token_diff_log_rows,
  count_if(raw_key_rows<>1 OR receipt_id IS NULL OR trim(receipt_id)='' OR log_index IS NULL) AS invalid_or_repeated_raw_key_rows,
  count_if(payloads IS NULL OR cardinality(payloads)=0) AS malformed_or_empty_data_log_rows
 FROM in_window GROUP BY 1
), contract_log_observations AS (
 SELECT day,count(*) AS successful_contract_log_rows FROM raw GROUP BY 1
), malformed_logs AS (
 SELECT r.day,count_if(parsed IS NULL) AS malformed_json_contract_log_rows
 FROM raw r CROSS JOIN cutoff c WHERE r.day BETWEEN c.end_day-INTERVAL '29' DAY AND c.end_day
 GROUP BY 1
), payload_audit AS (
 SELECT day,count(*) AS parsed_account_payloads,
  count_if(intent_hash_rows<>1) AS repeated_intent_hash_payloads,
  count_if(nullif(trim(account_id),'') IS NULL OR nullif(trim(intent_hash),'') IS NULL) AS missing_identity_payloads,
  count_if(deltas IS NULL OR cardinality(deltas)=0 OR invalid_amounts>0 OR invalid_token_keys>0) AS malformed_delta_payloads
 FROM profiled GROUP BY 1
), days AS (
 SELECT day FROM cutoff CROSS JOIN UNNEST(sequence(end_day-INTERVAL '29' DAY,end_day,INTERVAL '1' DAY)) t(day)
), activity AS (
 SELECT day,count(*) AS public_account_intents,count(DISTINCT account_id) AS active_signing_accounts,
  count_if(referral IS NULL) AS nonreferral_account_intents,
  count(DISTINCT CASE WHEN referral IS NULL THEN account_id END) AS nonreferral_active_accounts,
  count_if(simple_pair) AS simple_pair_account_intents,count_if(NOT simple_pair) AS multi_or_one_sided_account_intents,
  count_if(fees_field_present) AS fee_field_present_intents,count_if(nonempty_fee_map) AS nonempty_fee_map_intents
 FROM canonical GROUP BY 1
), proxy_accounts AS (
 SELECT account_id,count(*) AS n FROM canonical WHERE referral IS NULL GROUP BY 1
), proxy_shares AS (
 SELECT n,n*1.0/sum(n) OVER() AS share,row_number() OVER(ORDER BY n DESC,account_id) AS rank
 FROM proxy_accounts
), concentration AS (
 SELECT count(*) AS window_nonreferral_accounts,100.0*sum(CASE WHEN rank<=5 THEN share ELSE 0 END) AS window_nonreferral_top5_count_share_pct,
  10000.0*sum(share*share) AS window_nonreferral_hhi_count_basis FROM proxy_shares
)
SELECT d.day,c.end_day-INTERVAL '29' DAY AS window_start,c.end_day AS window_end,
 coalesce(o.successful_contract_log_rows,0) AS successful_contract_log_rows,
 count_if(o.successful_contract_log_rows>0) OVER() AS window_observed_contract_log_days,
 CASE WHEN o.successful_contract_log_rows>0 THEN coalesce(a.public_account_intents,0) END AS public_account_intents,
 CASE WHEN o.successful_contract_log_rows>0 THEN coalesce(a.active_signing_accounts,0) END AS active_signing_accounts,
 CASE WHEN o.successful_contract_log_rows>0 THEN coalesce(a.nonreferral_account_intents,0) END AS nonreferral_account_intents,
 CASE WHEN o.successful_contract_log_rows>0 THEN coalesce(a.nonreferral_active_accounts,0) END AS nonreferral_active_accounts,
 CASE WHEN o.successful_contract_log_rows>0 THEN coalesce(a.simple_pair_account_intents,0) END AS simple_pair_account_intents,
 CASE WHEN o.successful_contract_log_rows>0 THEN coalesce(a.multi_or_one_sided_account_intents,0) END AS multi_or_one_sided_account_intents,
 CASE WHEN o.successful_contract_log_rows>0 THEN coalesce(a.fee_field_present_intents,0) END AS fee_field_present_intents,
 CASE WHEN o.successful_contract_log_rows>0 THEN coalesce(a.nonempty_fee_map_intents,0) END AS nonempty_fee_map_intents,
 CASE WHEN o.successful_contract_log_rows>0 THEN coalesce(r.token_diff_log_rows,0) END AS token_diff_log_rows,
 CASE WHEN o.successful_contract_log_rows>0 THEN coalesce(r.invalid_or_repeated_raw_key_rows,0) END AS invalid_or_repeated_raw_key_rows,
 CASE WHEN o.successful_contract_log_rows>0 THEN coalesce(r.malformed_or_empty_data_log_rows,0) END AS malformed_or_empty_data_log_rows,
 CASE WHEN o.successful_contract_log_rows>0 THEN coalesce(p.parsed_account_payloads,0) END AS parsed_account_payloads,
 CASE WHEN o.successful_contract_log_rows>0 THEN coalesce(p.repeated_intent_hash_payloads,0) END AS repeated_intent_hash_payloads,
 CASE WHEN o.successful_contract_log_rows>0 THEN coalesce(p.missing_identity_payloads,0) END AS missing_identity_payloads,
 CASE WHEN o.successful_contract_log_rows>0 THEN coalesce(p.malformed_delta_payloads,0) END AS malformed_delta_payloads,
 CASE WHEN o.successful_contract_log_rows>0 THEN coalesce(m.malformed_json_contract_log_rows,0) END AS malformed_json_contract_log_rows,
 x.window_nonreferral_accounts,x.window_nonreferral_top5_count_share_pct,x.window_nonreferral_hhi_count_basis,
 'Nonreferral signing accounts are an unverified counterparty proxy, not solver identities; confidential activity excluded; DECIMAL38 conservative subset; null daily metrics mean no observed successful contract logs' AS scope,
 current_timestamp AS retrieved_utc
FROM days d CROSS JOIN cutoff c CROSS JOIN concentration x
LEFT JOIN contract_log_observations o ON o.day=d.day
LEFT JOIN activity a ON a.day=d.day LEFT JOIN raw_audit r ON r.day=d.day LEFT JOIN payload_audit p ON p.day=d.day LEFT JOIN malformed_logs m ON m.day=d.day
ORDER BY d.day
