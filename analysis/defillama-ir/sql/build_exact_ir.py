"""Validate saved public IR responses and emit DuneSQL. Run with Python; no credentials/network."""
import hashlib
import json
import math
import re
from datetime import date, timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parent
DATA = ROOT.parent
URLS = {'revenue': 'https://defillama.com/api/public/near/revenue', 'ecosystem': 'https://defillama.com/api/public/near/ecosystem'}
payloads = {key: json.loads((DATA / f'ir-{key}.json').read_bytes()) for key in URLS}
manifest = json.loads((DATA / 'ir-endpoints-manifest.json').read_text())
for key, payload in payloads.items():
    body = (DATA / f'ir-{key}.json').read_bytes()
    assert hashlib.sha256(body).hexdigest() == manifest[key]['sha256']
    assert len(body) < 4_194_304


def at(data, path):
    for part in path.split('.'):
        data = data[part]
    return data


def chart(key, path):
    data = at(payloads[key], path)
    dates = data['dates']
    assert dates == sorted(dates) and len(set(dates)) == len(dates)
    assert len({s['name'] for s in data['series']}) == len(data['series'])
    for s in data['series']:
        assert len(s['data']) == len(dates), (key, path, s['name'])
        assert all(v is None or isinstance(v, (int, float)) and math.isfinite(v) for v in s['data'])
    return data


queries = []


def write(name, title, sql, notes):
    (ROOT / name).write_text(sql + '\n', encoding='utf-8')
    queries.append(dict(file=name, title=title, notes=notes, sha256=hashlib.sha256((ROOT / name).read_bytes()).hexdigest()))


def wide(key, columns):
    for path, series, alias in columns:
        c = chart(key, path)
        assert any(s['name'] == series for s in c['series'])
    aliases = ','.join(f"'{alias}'" for _, _, alias in columns)
    names = ','.join(f"'{series}'" for _, series, _ in columns)
    charts = ','.join(f"json_extract(body,'$.{path}')" for path, _, _ in columns)
    derived = '''intents_fees_near+protocol_fees_near AS total_fees_near,
 intents_revenue_near+provider_burn_revenue_near AS total_revenue_near,
 sum(intents_fees_near+protocol_fees_near) OVER (ORDER BY day) AS cumulative_fees_near,
 sum(intents_revenue_near+provider_burn_revenue_near) OVER (ORDER BY day) AS cumulative_revenue_near,
 100*(intents_revenue_near+provider_burn_revenue_near)/nullif(emissions_near,0) AS revenue_pct_emissions,'''
    selection = ',\n '.join(f"max(CASE WHEN metric='{alias}' THEN value END) AS {alias}" for _, _, alias in columns)
    if key != 'revenue':
        derived = ''
    return f"""-- Public DefiLlama NEAR investor-relations feed; provider-reported, not independent verification.
-- Array position joins each value to its own chart date. Missing values remain NULL.
-- Excludes the current UTC date. Never sum daily counts into unique users.
WITH payload AS (SELECT json_parse(http_get('{URLS[key]}')) AS body),
charts AS (SELECT metric, series_name, c FROM payload
CROSS JOIN UNNEST(ARRAY[{aliases}],ARRAY[{names}],ARRAY[{charts}]) AS t(metric,series_name,c)),
points AS (
 SELECT CAST(element_at(CAST(json_extract(c,'$.dates') AS ARRAY(VARCHAR)), n) AS DATE) AS day,
 metric, CAST(json_extract_scalar(v,'$') AS DOUBLE) AS value
 FROM charts
 CROSS JOIN UNNEST(CAST(json_extract(c,'$.series') AS ARRAY(JSON))) AS s(series)
 CROSS JOIN UNNEST(CAST(json_extract(series,'$.data') AS ARRAY(JSON))) WITH ORDINALITY AS x(v,n)
 WHERE json_extract_scalar(series,'$.name')=series_name
), daily AS (
 SELECT day, {selection},
 count(*)-count(DISTINCT metric) AS duplicate_metric_rows
 FROM points WHERE day<current_date GROUP BY day
)
SELECT *, {derived} current_timestamp AS retrieved_utc FROM daily ORDER BY day DESC"""


revenue_cols = [
    ('fees.feesChart', 'Intent Fees', 'intents_fees_near'),
    ('fees.feesChart', 'Protocol Fees', 'protocol_fees_near'),
    ('revenue.revenueChart', 'Intents Revenue', 'intents_revenue_near'),
    ('revenue.revenueChart', 'Protocol Revenue (70% Burned)', 'provider_burn_revenue_near'),
    ('emissions.revenueVsEmissionsChart', 'Daily Emissions', 'emissions_near'),
]
write('10_ir_revenue_daily.sql', 'NEAR IR | Revenue and emissions', wide('revenue', revenue_cols),
      'NEAR-equivalent fees converted at daily prices; net receipts plus provider 70% gas-burn classification. Not tokenholder cash income or verified purchases.')
write('13_ir_ecosystem_daily.sql', 'NEAR IR | Base-chain and token history', wide('ecosystem', [
    ('ecosystem.txnsChart', 'Transactions', 'transactions'),
    ('ecosystem.activeAccountsChart', 'Active Accounts', 'active_accounts'),
    ('ecosystem.newAccountsChart', 'New Accounts', 'new_accounts'),
    ('ecosystem.gasChart', 'Gas Fees', 'gas_fees_near'),
    ('tokenEconomics.priceChart', 'Price', 'price_usd'),
    ('tokenEconomics.supplyChart', 'Total Supply', 'total_supply_near'),
    ('tokenEconomics.supplyChart', 'Circulating Supply', 'circulating_supply_near'),
]), 'Different columns have different units. Account identities and locked-supply methodology remain provider-defined.')
write('14_ir_intents_daily.sql', 'NEAR IR | Intents activity history', wide('ecosystem', [
    ('intents.volumeChart', 'Daily Volume', 'volume_usd'),
    ('intents.feesChart', 'Daily Fees', 'fees_usd'),
    ('intents.activityChart', 'Daily Swaps', 'swaps'),
]), 'Service notional, fees and swaps are separate measures. Gaps are NULL, not zero. Unique users are in the source scorecard, not summed daily counts.')


def scorecard(key, groups):
    rows = []
    for group, path, asof_chart, unit_for in groups:
        latest = chart(key, asof_chart)['dates'][-1]
        for metric, record in at(payloads[key], path).items():
            assert re.fullmatch(r'[A-Za-z][A-Za-z0-9_]*', metric), 'Unsafe source field name'
            assert isinstance(record['value'], (int, float)) and math.isfinite(record['value'])
            unit = unit_for(metric)
            rows.append([f"'{group}'", f"'{metric}'", f"'{unit}'", f"json_extract(body,'$.{path}.{metric}')", f"CAST(element_at(CAST(json_extract(body,'$.{asof_chart}.dates') AS ARRAY(VARCHAR)), -1) AS DATE)"])
    vals = ',\n '.join('ARRAY[' + ','.join(row[i] for row in rows) + ']' for i in range(5))
    return f"""-- Exact provider scorecard fields. Periods are those named in metric, not recomputed windows.
-- Intents totalSwaps and cumulativeSwaps disagree in the source; retain both visibly.
-- As-of is the latest date of the related chart, not an independently verified KPI cutoff.
WITH payload AS (SELECT json_parse(http_get('{URLS[key]}')) AS body)
SELECT section, metric, CAST(json_extract_scalar(kpi,'$.value') AS DOUBLE) AS value,
unit, json_extract_scalar(kpi,'$.formatted') AS display_value, related_chart_latest_date,
current_timestamp AS retrieved_utc
FROM payload CROSS JOIN UNNEST(
 {vals}
) AS t(section,metric,unit,kpi,related_chart_latest_date)
ORDER BY section,metric"""


write('11_ir_revenue_scorecard.sql', 'NEAR IR | Revenue scorecard', scorecard('revenue', [
    ('Fees', 'fees.kpis', 'fees.feesChart', lambda m: 'NEAR'),
    ('Revenue', 'revenue.kpis', 'revenue.revenueChart', lambda m: 'NEAR'),
    ('Emissions', 'emissions.kpis', 'emissions.revenueVsEmissionsChart', lambda m: '%' if m == 'latestPercentage' else 'NEAR'),
]), 'Original API fields and formatting. Revenue is the IR accounting definition, not distributable tokenholder earnings.')
write('12_ir_ecosystem_scorecard.sql', 'NEAR IR | Ecosystem scorecard', scorecard('ecosystem', [
    ('Intents', 'intents.kpis', 'intents.volumeChart', lambda m: 'USD' if 'Volume' in m or m.startswith('volume') or m in ('avgTradeSize', 'totalIntentFees') else 'provider user IDs' if 'Users' in m else 'swaps'),
    ('Base chain', 'ecosystem.kpis', 'ecosystem.txnsChart', lambda m: 'NEAR' if m == 'dailyGasFeeNear' else 'accounts' if 'Accounts' in m else 'transactions/day'),
    ('Token', 'tokenEconomics.kpis', 'tokenEconomics.supplyChart', lambda m: 'USD' if m in ('nearPrice', 'marketCap') else 'NEAR'),
]), 'Provider-reported users, swaps and supply. totalSwaps and cumulativeSwaps differ; no entity deduplication or supply-methodology reconciliation claimed.')

breakdown_sql = f"""-- Source token/chain labels, last 30 available completed dates per dimension.
-- The feed can lag wall-clock time. Period boundaries and observed-date counts are returned.
WITH payload AS (SELECT json_parse(http_get('{URLS['ecosystem']}')) AS body),
charts AS (SELECT dimension,c FROM payload CROSS JOIN UNNEST(
 ARRAY['Token','Blockchain'],
 ARRAY[json_extract(body,'$.intents.tokenBreakdown'),json_extract(body,'$.intents.blockchainBreakdown')]
) AS t(dimension,c)), points AS (
 SELECT dimension,json_extract_scalar(series,'$.name') AS label,
 CAST(element_at(CAST(json_extract(c,'$.dates') AS ARRAY(VARCHAR)), n) AS DATE) AS day,
 CAST(json_extract_scalar(v,'$') AS DOUBLE) AS volume_usd
 FROM charts CROSS JOIN UNNEST(CAST(json_extract(c,'$.series') AS ARRAY(JSON))) AS s(series)
 CROSS JOIN UNNEST(CAST(json_extract(series,'$.data') AS ARRAY(JSON))) WITH ORDINALITY AS x(v,n)
), dated AS (SELECT *,max(day) OVER (PARTITION BY dimension) AS period_end
 FROM points WHERE day<current_date), totals AS (
 SELECT dimension,label,period_end,min(day) AS period_start,count(DISTINCT day) AS observed_dates,
 sum(volume_usd) AS volume_usd FROM dated
 WHERE day>=period_end-interval '29' day GROUP BY 1,2,3
)
SELECT *,100*volume_usd/nullif(sum(volume_usd) OVER (PARTITION BY dimension),0) AS share_pct,
current_timestamp AS retrieved_utc FROM totals ORDER BY dimension,volume_usd DESC"""
write('15_ir_intents_mix.sql', 'NEAR IR | Intents token and chain mix', breakdown_sql,
      'Token symbols and blockchain labels are source labels. All-time referral fees remain a separate measure; never infer fee share from volume share.')

write('16_ir_wallets_channels.sql', 'NEAR IR | Revenue wallets and fee channels', f"""-- Separate source scopes and units; never add these two groups together.
-- Wallet window is provider-defined last 12 months. Channel fees are all-time.
WITH r AS (SELECT json_parse(http_get('{URLS['revenue']}')) AS body),
e AS (SELECT json_parse(http_get('{URLS['ecosystem']}')) AS body), rows AS (
 SELECT 'Revenue wallets' AS section,json_extract_scalar(w,'$.wallet') AS label,
 CAST(json_extract_scalar(w,'$.total') AS DOUBLE) AS value,'NEAR' AS unit,
 100*CAST(json_extract_scalar(w,'$.total') AS DOUBLE)/nullif(CAST(json_extract_scalar(body,'$.revenue.walletBreakdown.total') AS DOUBLE),0) AS share_pct,
 'Last 12 months (provider window)' AS period
 FROM r CROSS JOIN UNNEST(CAST(json_extract(body,'$.revenue.walletBreakdown.wallets') AS ARRAY(JSON))) AS t(w)
 UNION ALL
 SELECT 'Reported fee channels',json_extract_scalar(c,'$.referral'),
 CAST(json_extract_scalar(c,'$.fees') AS DOUBLE),'USD',
 CAST(json_extract_scalar(c,'$.sharePct') AS DOUBLE),'All-time (provider window)'
 FROM e CROSS JOIN UNNEST(CAST(json_extract(body,'$.intents.channelBreakdown.channels') AS ARRAY(JSON))) AS t(c)
)
SELECT *,current_timestamp AS retrieved_utc FROM rows ORDER BY section,value DESC""",
      'Two independent groups with different units and windows. Channel aggregate is not interchangeable with total Intents fees. Wallet labels are provider classifications, not verified receipts.')

# Preserve material discrepancies rather than making the dashboard numbers agree by construction.
e = payloads['ecosystem']
r = payloads['revenue']
swaps = e['intents']['kpis']
native = chart('ecosystem', 'ecosystem.txnsChart')
rev = chart('revenue', 'revenue.revenueChart')
fees = chart('revenue', 'fees.feesChart')
for chart_data, expected in [(fees, r['fees']['kpis']['allTimeFees']['value']),
                             (rev, r['revenue']['kpis']['allTimeRevenue']['value'])]:
    daily_total = sum(v for s in chart_data['series'] if s['name'] != 'Cumulative Total' for v in s['data'] if v is not None)
    assert math.isclose(daily_total, expected, abs_tol=.01), (daily_total, expected)
    cumulative = next(s['data'][-1] for s in chart_data['series'] if s['name'] == 'Cumulative Total')
    assert math.isclose(cumulative, expected, abs_tol=.01)
assert math.isclose(e['tokenEconomics']['kpis']['totalSupply']['value'] -
                    e['tokenEconomics']['kpis']['circulatingSupply']['value'],
                    e['tokenEconomics']['kpis']['lockedSupply']['value'], abs_tol=.01)
assert math.isclose(sum(native['series'][0]['data'][-7:]) / 7,
                    e['ecosystem']['kpis']['avgDailyTxns7d']['value'], abs_tol=.01)
checks = {
    'sources': manifest,
    'queries': queries,
    'source_updated_utc': r['metadata']['updatedAt'],
    'revenue_latest_date': rev['dates'][-1],
    'ecosystem_latest_date': native['dates'][-1],
    'source_discrepancies': {
        'reported_total_swaps': swaps['totalSwaps']['value'],
        'reported_cumulative_swaps': swaps['cumulativeSwaps']['value'],
        'difference_swaps': swaps['cumulativeSwaps']['value'] - swaps['totalSwaps']['value'],
        'native_transactions_latest_ir': native['series'][0]['data'][-1],
        'native_transactions_latest_prior_dune': 706698,
    },
    'limits': ['Public custom endpoints have no stability contract found.', 'Dune LiveFetch still must succeed within its 5-second timeout.',
               'No independent receipt-level audit of the IR metrics.', 'Products tab is editorial content, not a quantitative API series.'],
}
executed = {}
for filename, key, groups in [
    ('11-dune-scorecard.json', 'revenue', {'Fees': 'fees.kpis', 'Revenue': 'revenue.kpis', 'Emissions': 'emissions.kpis'}),
    ('12-dune-scorecard.json', 'ecosystem', {'Intents': 'intents.kpis', 'Base chain': 'ecosystem.kpis', 'Token': 'tokenEconomics.kpis'}),
]:
    capture = ROOT / filename
    if capture.exists():
        header, *body = json.loads(capture.read_text(encoding='utf-8'))
        records = [dict(zip(header, row, strict=True)) for row in body]
        assert len(records) == sum(len(at(payloads[key], p)) for p in groups.values())
        assert len({(row['section'], row['metric']) for row in records}) == len(records)
        for row in records:
            expected = at(payloads[key], groups[row['section']])[row['metric']]
            assert math.isclose(float(row['value']), expected['value'], rel_tol=1e-12, abs_tol=1e-8)
            assert row['display_value'] == expected['formatted']
        executed[filename] = len(records)
for filename, columns in [('13-dune-sample.json', [
    ('ecosystem.txnsChart', 'Transactions'), ('ecosystem.activeAccountsChart', 'Active Accounts'),
    ('ecosystem.newAccountsChart', 'New Accounts'), ('ecosystem.gasChart', 'Gas Fees'),
    ('tokenEconomics.priceChart', 'Price'), ('tokenEconomics.supplyChart', 'Total Supply'),
    ('tokenEconomics.supplyChart', 'Circulating Supply')]),
    ('14-dune-sample.json', [('intents.volumeChart', 'Daily Volume'), ('intents.feesChart', 'Daily Fees'), ('intents.activityChart', 'Daily Swaps')])]:
    capture = ROOT / filename
    if capture.exists():
        body = json.loads(capture.read_text(encoding='utf-8'))
        if isinstance(body, dict):
            body = body['rows']
        for row in body:
            day = row[0][:10]
            for i, (path, name) in enumerate(columns, 1):
                data = chart('ecosystem', path)
                values = next(s['data'] for s in data['series'] if s['name'] == name)
                expected = values[data['dates'].index(day)] if day in data['dates'] else None
                assert (not row[i] and expected is None) or expected is not None and math.isclose(float(row[i]), expected, rel_tol=1e-12, abs_tol=1e-8)
            assert row[len(columns)+1] == '0'
        executed[filename] = len(body)
checks['executed_dune_capture_checks'] = executed
capture = ROOT / '10-dune-sample.json'
if capture.exists():
    header, *body = json.loads(capture.read_text(encoding='utf-8'))
    for raw in body:
        row = dict(zip(header, raw, strict=True))
        day = row['day'][:10]
        for path, name, field in revenue_cols:
            data = chart('revenue', path)
            expected = next(s['data'] for s in data['series'] if s['name'] == name)[data['dates'].index(day)]
            assert math.isclose(float(row[field]), expected, rel_tol=1e-12, abs_tol=1e-8)
        assert row['duplicate_metric_rows'] == '0'
        assert math.isclose(float(row['total_revenue_near']), float(row['intents_revenue_near'])+float(row['provider_burn_revenue_near']), rel_tol=1e-12)
        assert math.isclose(float(row['total_fees_near']), float(row['intents_fees_near'])+float(row['protocol_fees_near']), rel_tol=1e-12)
    executed[capture.name] = len(body)
for filename, group_field, value_field in [('15-dune-mix.json', 'dimension', 'volume_usd'), ('16-dune-breakdowns.json', 'section', 'value')]:
    capture = ROOT / filename
    if capture.exists():
        header, *body = json.loads(capture.read_text(encoding='utf-8'))
        records = [dict(zip(header, row, strict=True)) for row in body]
        assert records and len({(r[group_field], r['label']) for r in records}) == len(records)
        if filename == '15-dune-mix.json':
            for row in records:
                path = 'intents.tokenBreakdown' if row['dimension'] == 'Token' else 'intents.blockchainBreakdown'
                data = chart('ecosystem', path)
                end = max(d for d in data['dates'] if d < row['retrieved_utc'][:10])
                start = (date.fromisoformat(end)-timedelta(days=29)).isoformat()
                indices = [i for i, d in enumerate(data['dates']) if start <= d <= end]
                totals = {s['name']: sum(s['data'][i] for i in indices if s['data'][i] is not None) for s in data['series']}
                expected = totals[row['label']]
                assert math.isclose(float(row['volume_usd']), expected, rel_tol=1e-12, abs_tol=1e-6)
                assert math.isclose(float(row['share_pct']), expected/sum(totals.values())*100, abs_tol=1e-8)
                assert row['period_end'][:10] == end and int(row['observed_dates']) == len(indices)
            executed[filename] = {'visible_sample_rows': len(records), 'complete_capture': False}
            continue
        assert len(records) == len(e['intents']['channelBreakdown']['channels'])+len(r['revenue']['walletBreakdown']['wallets'])
        for row in records:
            items = r['revenue']['walletBreakdown']['wallets'] if row['section'] == 'Revenue wallets' else e['intents']['channelBreakdown']['channels']
            expected = next(v for v in items if v.get('wallet', v.get('referral')) == row['label'])
            assert math.isclose(float(row['value']), expected.get('total', expected.get('fees')), rel_tol=1e-12, abs_tol=1e-8)
        for group in {r[group_field] for r in records}:
            selected = [r for r in records if r[group_field] == group]
            assert math.isclose(sum(float(r['share_pct']) for r in selected), 100, abs_tol=1e-6)
            total = sum(float(r[value_field]) for r in selected)
            for row in selected:
                assert math.isclose(float(row['share_pct']), float(row[value_field])/total*100, abs_tol=1e-6)
        executed[filename] = len(records)
(ROOT / 'exact-ir-validation.json').write_text(json.dumps(checks, indent=2), encoding='utf-8')
print('PASS: two source hashes, parallel date/value arrays, unique series/dates, finite values and KPI reconciliation; seven exact-IR queries emitted.')
