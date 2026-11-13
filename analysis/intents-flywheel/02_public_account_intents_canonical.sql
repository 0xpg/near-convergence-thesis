-- Public token_diff statement grain: receipt_id/log_index/data_ordinal; not unique swaps or verified solvers.
-- A signed payload can execute multiple statements with the SAME intent_hash. Repeated hashes are retained.
-- Exact business-field raw copies collapse; conflicting physical-key versions are quarantined, never chosen by row order.
-- DIP4 token_diff event version 0.4.3 is verified from observed events and deployed source; other versions are withheld.
-- Signed i128 deltas validate lexically, including valid 39-digit values; no precision-losing quantity cast.
-- Thirty completed event days ending at latest parsed public token_diff within a bounded 90-day scan. Confidential execution absent.
WITH raw_versions AS (
 SELECT block_date AS day,block_time,block_height,receipt_id,index_in_execution_outcome_logs AS log_index,
  execution_status,event,count(*) AS source_copies
 FROM near.logs
 WHERE executor_account_id='intents.near' AND execution_status LIKE 'SUCCESS%'
 AND block_date>=current_date-INTERVAL '90' DAY AND block_date<current_date
 GROUP BY 1,2,3,4,5,6,7
), raw AS (
 SELECT *,try(json_parse(event)) AS parsed,
  count(*) OVER(PARTITION BY receipt_id,log_index) AS raw_key_versions
 FROM raw_versions
), typed AS (
 SELECT *,json_extract_scalar(parsed,'$.version') AS event_version,
  try(CAST(json_extract(parsed,'$.data') AS array(json))) AS payloads
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
 SELECT *,count(*) OVER(PARTITION BY intent_hash,account_id) AS intent_hash_rows
 FROM expanded
), profiled AS (
 SELECT k.*,
  cardinality(filter(map_values(deltas),v->substr(v,1,1)='-')) AS negative_assets,
  cardinality(filter(map_values(deltas),v->substr(v,1,1)<>'-')) AS positive_assets,
  cardinality(filter(map_values(deltas),v->NOT coalesce((v IS NOT NULL AND regexp_like(v,'^-?(0|[1-9][0-9]*)$') AND v NOT IN ('0','-0')
   AND (length(regexp_replace(v,'^-',''))<39
    OR (length(regexp_replace(v,'^-',''))=39 AND regexp_replace(v,'^-','')<=
     CASE WHEN substr(v,1,1)='-' THEN '170141183460469231731687303715884105728' ELSE '170141183460469231731687303715884105727' END))),false))) AS invalid_amounts,
  cardinality(filter(map_keys(deltas),a->a IS NULL OR trim(a)='')) AS invalid_token_keys,
  element_at(map_keys(map_filter(deltas,(a,v)->substr(v,1,1)='-')),1) AS input_asset,
  element_at(map_keys(map_filter(deltas,(a,v)->substr(v,1,1)<>'-')),1) AS output_asset
 FROM keyed k
), canonical AS (
 SELECT *,negative_assets=1 AND positive_assets=1 AS simple_pair,
  cardinality(fees_map)>0 AS nonempty_fee_map
 FROM profiled WHERE receipt_id IS NOT NULL AND trim(receipt_id)<>'' AND log_index IS NOT NULL AND log_index>=0
 AND raw_key_versions=1 AND event_version='0.4.3'
 AND nullif(trim(account_id),'') IS NOT NULL AND nullif(trim(intent_hash),'') IS NOT NULL
 AND deltas IS NOT NULL AND cardinality(deltas)>0 AND invalid_amounts=0 AND invalid_token_keys=0
)
SELECT day,block_time,receipt_id,log_index,ordinal,account_id,intent_hash,referral,
 event_version,source_copies,raw_key_versions,intent_hash_rows,deltas,negative_assets,positive_assets,simple_pair,
 CASE WHEN simple_pair THEN input_asset END AS simple_input_asset,
 CASE WHEN simple_pair THEN output_asset END AS simple_output_asset,
 fees_field_present,nonempty_fee_map,fees_map
FROM canonical ORDER BY day,block_time,receipt_id,log_index,ordinal
