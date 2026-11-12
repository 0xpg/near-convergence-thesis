WITH native AS (
 SELECT min(day) AS first_day,max(day) AS last_day,count(DISTINCT day) AS dates,
 avg(CAST(successful_execution_hashes AS double)) AS avg_hashes,
 avg(CAST(active_originating_accounts AS double)) AS avg_originators,
 CAST(sum(accepted_parent_action_rows) AS double)/nullif(sum(successful_execution_hashes),0) AS actions_per_hash,
 sum(missing_hash_groups)+sum(inconsistent_originator_groups) AS id_issues
 FROM query_9116129
), transfers AS (
 SELECT min(day) AS first_day,max(day) AS last_day,count(DISTINCT day) AS dates,
 sum(gross_token_units) AS nominal_units,sum(direct_intents_custody_units) AS custody_units,
 sum(fully_priced_gross_usd) AS priced_group_usd,sum(unpriced_legs) AS unpriced_legs,
 sum(ambiguous_legs) AS ambiguous_legs
 FROM query_9117819
), balances AS (
 SELECT min(day) AS first_day,max(day) AS last_day,
 max_by(reported_total_usd,day) AS latest_priced_total,
 max_by(confidential_usd,day) AS latest_priced_confidential,
 max(repeated_keys) AS repeated_keys,max(invalid_rows) AS invalid_rows,
 max_by(unpriced_positive_balance_rows,day) AS latest_unpriced_balance_rows
 FROM query_9117785
), capital AS (
 SELECT min(day) AS first_day,max(day) AS last_day,
 max_by(circulating_total_usd,day) AS latest_circulation,
 max_by(issuer_unreleased_nominal_units,day) AS latest_unreleased_units,
 max_by(value_usd,day) FILTER (WHERE series='USDT') AS latest_usdt,
 max_by(value_usd,day) FILTER (WHERE series='USDC') AS latest_usdc,
 max(duplicate_source_dates) AS duplicates,max(invalid_points) AS invalid_points
 FROM query_9117903
), fees AS (
 SELECT min(day) AS first_day,max(day) AS last_day,count(DISTINCT day) AS dates,
 sum(reported_priced_fees_usd) AS reported_fees,
 sum(CASE WHEN source_type='confidential' THEN reported_priced_fees_usd END) AS confidential_fees,
 sum(missing_fee_rows) AS missing_fee_rows,sum(invalid_numeric_rows) AS invalid_rows
 FROM query_9117854 WHERE day>=current_date-interval '30' day AND day<current_date
), volume AS (
 SELECT min(day) AS first_day,max(day) AS last_day,count(DISTINCT day) AS dates,
 sum(reported_volume_usd) AS reported_volume,
 sum(CASE WHEN source_type='confidential' THEN reported_volume_usd END) AS confidential_volume,
 sum(positive_tokens_unpriced_rows) AS unpriced_rows,sum(invalid_numeric_rows) AS invalid_rows
 FROM query_9115683 WHERE day>=current_date-interval '30' day AND day<current_date
)
SELECT 'Native execution' AS category,t.metric,t.value,t.unit,first_day,last_day,
 concat(CAST(dates AS varchar),' observed dates; identifier issues=',CAST(id_issues AS varchar),'. Execution-day hashes and originating accounts, not final transaction outcomes or people.') AS interpretation
FROM native CROSS JOIN UNNEST(
 ARRAY['Average daily successful execution hashes','Average daily originating accounts','Action rows per successful daily hash appearance'],
 ARRAY[CASE WHEN dates=30 AND id_issues=0 THEN avg_hashes END,CASE WHEN dates=30 AND id_issues=0 THEN avg_originators END,CASE WHEN dates=30 AND id_issues=0 THEN actions_per_hash END],
 ARRAY['count/day','accounts/day','action rows/hash appearance']) AS t(metric,value,unit)
UNION ALL
SELECT 'Stablecoin movement',t.metric,t.value,t.unit,first_day,last_day,
 concat(CAST(dates AS varchar),' observed dates; ambiguous legs=',CAST(ambiguous_legs AS varchar),'; unpriced legs=',CAST(unpriced_legs AS varchar),'. Current 17-contract roster; gross movement includes custody and refunds, not payments.')
FROM transfers CROSS JOIN UNNEST(
 ARRAY['Gross nominal transfer units','Direct Intents custody share of nominal transfer units','USD sum of fully priced contract groups','Unpriced transfer legs'],
 ARRAY[CASE WHEN ambiguous_legs=0 THEN nominal_units END,CASE WHEN ambiguous_legs=0 THEN 100*custody_units/nullif(nominal_units,0) END,CASE WHEN ambiguous_legs=0 THEN priced_group_usd END,CAST(unpriced_legs AS double)],
 ARRAY['nominal USDC/USDT units','% of nominal gross units','USD; priced subset only','legs']) AS t(metric,value,unit)
UNION ALL
SELECT 'Intents balances',t.metric,t.value,t.unit,first_day,last_day,
 concat('Duplicate keys=',CAST(repeated_keys AS varchar),'; invalid rows=',CAST(invalid_rows AS varchar),'; latest positive unpriced balance rows=',CAST(latest_unpriced_balance_rows AS varchar),'. Priced reported custody balances; confidential is a subset of raw public total.')
FROM balances CROSS JOIN UNNEST(
 ARRAY['Latest reported priced balance','Confidential share of reported priced balance'],
 ARRAY[CASE WHEN repeated_keys=0 AND invalid_rows=0 THEN latest_priced_total END,CASE WHEN repeated_keys=0 AND invalid_rows=0 THEN 100*latest_priced_confidential/nullif(latest_priced_total,0) END],
 ARRAY['USD; priced subset','% of priced balance']) AS t(metric,value,unit)
UNION ALL
SELECT 'Stablecoin circulation',t.metric,t.value,t.unit,first_day,last_day,
 concat('Duplicate dates=',CAST(duplicates AS varchar),'; invalid points=',CAST(invalid_points AS varchar),'. Circulation excludes unreleased reserves. Categories follow provider representation coverage.')
FROM capital CROSS JOIN UNNEST(
 ARRAY['Latest circulating stablecoin value','Latest USDC circulating value','Latest USDT circulating value','Issuer unreleased inventory'],
 ARRAY[latest_circulation,latest_usdc,latest_usdt,latest_unreleased_units],
 ARRAY['USD','USD','USD','nominal units; excluded from circulation']) AS t(metric,value,unit)
UNION ALL
SELECT 'Intents fees',t.metric,t.value,t.unit,first_day,last_day,
 concat(CAST(dates AS varchar),' observed dates; missing fee rows=',CAST(missing_fee_rows AS varchar),'; invalid rows=',CAST(invalid_rows AS varchar),'. Protocol fees assigned public by official reporting convention. Accrual is not captured receipts or purchases.')
FROM fees CROSS JOIN UNNEST(
 ARRAY['30D reported gross fees','Confidential share of reported gross fees'],
 ARRAY[reported_fees,100*confidential_fees/nullif(reported_fees,0)],ARRAY['USD; reported subset','% of reported fees']) AS t(metric,value,unit)
UNION ALL
SELECT 'Intents notional',t.metric,t.value,t.unit,first_day,last_day,
 concat(CAST(dates AS varchar),' observed dates; positive-token unpriced rows=',CAST(unpriced_rows AS varchar),'; invalid rows=',CAST(invalid_rows AS varchar),'. Reported dataset notional; not independently verified unique order notional.')
FROM volume CROSS JOIN UNNEST(
 ARRAY['30D reported priced volume','Confidential share of reported priced volume'],
 ARRAY[reported_volume,100*confidential_volume/nullif(reported_volume,0)],ARRAY['USD; reported subset','% of reported volume']) AS t(metric,value,unit)
ORDER BY category,metric
