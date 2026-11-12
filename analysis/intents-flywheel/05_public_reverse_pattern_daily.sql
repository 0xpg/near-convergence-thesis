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
, parameters(horizon_minutes,tolerance_pct) AS (
 VALUES (15,1),(15,5),(60,1),(60,5),(240,1),(240,5)
), simple AS (
 SELECT *,abs(try_cast(element_at(deltas,input_asset) AS double)) AS input_raw,
  try_cast(element_at(deltas,output_asset) AS double) AS output_raw
 FROM canonical WHERE simple_pair AND block_time IS NOT NULL
), adjacent AS (
 SELECT *,lag(block_time) OVER w AS previous_time,
  lag(input_asset) OVER w AS previous_input_asset,lag(output_asset) OVER w AS previous_output_asset,
  lag(input_raw) OVER w AS previous_input_raw,lag(output_raw) OVER w AS previous_output_raw
 FROM simple
 WINDOW w AS (PARTITION BY account_id ORDER BY block_time,receipt_id,log_index,ordinal)
), candidate_pairs AS (
 SELECT a.*,p.horizon_minutes,p.tolerance_pct,
  coalesce(block_time>previous_time AND block_time<=date_add('minute',horizon_minutes,previous_time)
   AND input_asset=previous_output_asset AND output_asset=previous_input_asset
   AND previous_input_raw>0 AND previous_output_raw>0
   AND abs(output_raw-previous_input_raw)/previous_input_raw<=tolerance_pct/100.0
   AND abs(input_raw-previous_output_raw)/previous_output_raw<=tolerance_pct/100.0,false) AS reverse_with_previous
 FROM adjacent a CROSS JOIN parameters p
), flagged_events AS (
 SELECT *,reverse_with_previous OR coalesce(lead(reverse_with_previous) OVER (
  PARTITION BY account_id,horizon_minutes,tolerance_pct ORDER BY block_time,receipt_id,log_index,ordinal),false) AS reverse_pattern_event
 FROM candidate_pairs
), daily_flags AS (
 SELECT day,horizon_minutes,tolerance_pct,count(*) AS assessable_simple_account_events,
  count_if(previous_time IS NULL) AS no_prior_observed_simple_event,
  count_if(reverse_with_previous) AS adjacent_reverse_candidate_pairs,
  count_if(reverse_pattern_event) AS distinct_flagged_account_events
 FROM flagged_events GROUP BY 1,2,3
), daily_population AS (
 SELECT day,count(*) AS retained_public_account_events,
  count_if(NOT simple_pair OR block_time IS NULL) AS behavior_unassessable_account_events
 FROM canonical GROUP BY 1
), observed_contract_days AS (
 SELECT day,count(*) AS observed_successful_contract_log_rows FROM raw GROUP BY 1
), days AS (
 SELECT day FROM cutoff CROSS JOIN UNNEST(sequence(end_day-INTERVAL '29' DAY,end_day,INTERVAL '1' DAY)) t(day)
)
SELECT d.day,c.end_day-INTERVAL '29' DAY AS window_start,c.end_day AS window_end,
 p.horizon_minutes,p.tolerance_pct,
 CAST(p.horizon_minutes AS varchar) || 'm / ' || CAST(p.tolerance_pct AS varchar) || '%' AS scenario,
 coalesce(o.observed_successful_contract_log_rows,0) AS observed_successful_contract_log_rows,
 coalesce(a.retained_public_account_events,0) AS retained_public_account_events,
 coalesce(a.behavior_unassessable_account_events,0) AS behavior_unassessable_account_events,
 coalesce(f.assessable_simple_account_events,0) AS assessable_simple_account_events,
 coalesce(f.no_prior_observed_simple_event,0) AS no_prior_observed_simple_event,
 coalesce(f.adjacent_reverse_candidate_pairs,0) AS adjacent_reverse_candidate_pairs,
 coalesce(f.distinct_flagged_account_events,0) AS distinct_flagged_account_events,
 CASE WHEN f.assessable_simple_account_events>0 THEN 100.0*f.distinct_flagged_account_events/f.assessable_simple_account_events END AS flagged_share_of_assessable_events_pct,
 0 AS behavioral_excluded_account_events,
 'Adjacent public simple-pair account events only; both reverse legs quantity-matched; automation/arbitrage may qualify; not wash proof, unique swaps, solver identities or USD volume. Zeros mean no retained events observed, not certified ingestion completeness. First account observation lacks prior-window context.' AS scope,
 current_timestamp AS retrieved_utc
FROM days d CROSS JOIN cutoff c CROSS JOIN parameters p
LEFT JOIN daily_population a ON a.day=d.day
LEFT JOIN observed_contract_days o ON o.day=d.day
LEFT JOIN daily_flags f ON f.day=d.day AND f.horizon_minutes=p.horizon_minutes AND f.tolerance_pct=p.tolerance_pct
ORDER BY d.day,p.horizon_minutes,p.tolerance_pct
