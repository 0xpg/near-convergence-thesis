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
)
SELECT day,block_time,receipt_id,log_index,ordinal,account_id,intent_hash,referral,
 deltas,negative_assets,positive_assets,simple_pair,
 CASE WHEN simple_pair THEN input_asset END AS simple_input_asset,
 CASE WHEN simple_pair THEN output_asset END AS simple_output_asset,
 fees_field_present,nonempty_fee_map,fees_map
FROM canonical ORDER BY day,block_time,receipt_id,log_index,ordinal
