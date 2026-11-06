"""Reproduce dated chart insights from bundled source snapshots; no network or credentials."""
import csv
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal, getcontext
import hashlib
import json
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
SOURCES = ROOT / 'data/glance-sources'
OUTPUT = ROOT / 'data/glance-insights.json'
D = Decimal
getcontext().prec = 60


def build():
    manifest = json.loads((SOURCES / 'manifest.json').read_text(encoding='utf-8'))
    for entry in manifest:
        assert hashlib.sha256((SOURCES / entry['file']).read_bytes()).hexdigest() == entry['sha256'], entry['file']

    def read(name):
        return json.loads((SOURCES / name).read_text(encoding='utf-8'))

    def rows(name, value):
        header, *body = read(name)['rows']
        result = [dict(zip(header, row, strict=True)) for row in body]
        assert result and len({row['name'] for row in result}) == len(result)
        total = sum(D(row[value]) for row in result)
        assert total > 0 and all(D(row[value]).is_finite() and D(row[value]) >= 0 for row in result)
        assert abs(sum(D(row['share_pct']) for row in result) - 100) < D('.000002')
        for row in result:
            assert abs(D(row['share_pct']) - D(row[value]) * 100 / total) < D('.000002')
        return result, total

    insights = {}

    def add(key, value, headline, cutoff, limitation, source, calculation):
        insights[key] = dict(value=value, headline=headline, date=cutoff, limitation=limitation,
                             source=source, calculation=calculation)

    with (SOURCES / 'capital-history.csv').open(encoding='utf-8-sig', newline='') as handle:
        history = list(csv.DictReader(handle))
    assert len({(r['metric'], r['date_utc']) for r in history}) == len(history)
    for key, metric, label, source in [
        ('defi-capital', 'defi_tvl', 'DeFi capital', 'https://api.llama.fi/v2/historicalChainTvl/Near'),
        ('stablecoins', 'stablecoin_usd', 'Stablecoin circulating value', 'https://stablecoins.llama.fi/stablecoincharts/Near')]:
        points = {r['date_utc']: D(r['value_usd']) for r in history if r['metric'] == metric}
        assert all(v.is_finite() and v >= 0 for v in points.values())
        end = max(points)
        start = (date.fromisoformat(end) - timedelta(days=30)).isoformat()
        assert start in points and points[start] > 0
        latest, previous = points[end], points[start]
        change = (latest / previous - 1) * 100
        direction = 'rose' if change >= 0 else 'fell'
        caveat = ('USD changes reflect prices and balances, not net deposits.' if key == 'defi-capital'
                  else 'Circulating value is a balance, not transfer volume; it can overlap DeFi TVL.')
        caveat += ' The ending date was captured intraday and may be revised.'
        add(key, f'${latest / 1000000:,.1f}m', f'{label} {direction} {abs(change):.1f}% over 30 days.',
            end + ' UTC snapshot', caveat, source,
            dict(method='(ending balance / starting balance - 1) × 100', start=start, end=end,
                 start_usd=str(previous), end_usd=str(latest), change_pct=str(change)))

    start, end = '2026-09-27', '2026-10-26'
    period = start + '–' + end + ' · 30 completed UTC days'

    def daily_total(name):
        points = read(name)['totalDataChart']
        dates = [datetime.fromtimestamp(int(t), timezone.utc).date().isoformat() for t, _ in points]
        assert len(dates) == len(set(dates))
        selected = [(day, D(str(value))) for day, (_, value) in zip(dates, points) if start <= day <= end]
        assert len(selected) == 30 and all(value.is_finite() and value >= 0 for _, value in selected)
        return sum(value for _, value in selected)

    volume = daily_total('intents-volume-api.json')
    add('intents-volume', f'${volume / 1000000000:,.2f}bn',
        f'Reported Intents volume averaged ${volume / 30 / 1000000:,.1f}m a day.', period,
        'Cross-chain service notional, not NEAR L1 settlement or NEAR token demand.',
        'https://api.llama.fi/summary/dexs/near-intents',
        dict(method='Sum daily volume for 30 dates; divide by 30 for daily average', start=start, end=end,
             volume_usd=str(volume), daily_average_usd=str(volume / 30)))

    fee_capture = read('intents-fees-dune.json')
    header, *body = fee_capture['rows']
    fee_rows = [dict(zip(header, row, strict=True)) for row in body]
    fee_capture_dates = sorted({r['day'][:10] for r in fee_rows})
    fee_window_verified = (fee_capture_dates == [(date.fromisoformat(start) + timedelta(days=i)).isoformat() for i in range(30)])
    gross = D(fee_rows[0]['gross_30d_usd'])
    distribution = D(fee_rows[0]['distribution_30d_usd'])
    assert all(D(r['gross_30d_usd']) == gross and D(r['distribution_30d_usd']) == distribution for r in fee_rows)
    assert gross >= distribution >= 0
    api_fees = daily_total('intents-fees-api.json')
    gap = gross - api_fees
    add('intents-fees', f'${api_fees / 1000000:,.2f}m',
        'Reported gross service fees over 30 completed UTC days.', period,
        f'Not tokenholder revenue. The saved Dune aggregate is ${gross / 1000000:.2f}m with an unverified reporting window; it is not a reconciled same-period comparison.',
        'https://api.llama.fi/summary/fees/near-intents?dataType=dailyFees',
        dict(method='Sum API dailyFees for 30 completed UTC dates. Retain saved Dune aggregate separately; its reporting window is unverified.',
        reporting_window_verified=fee_window_verified, captured_daily_dates=fee_capture_dates,
        comparison_api_start=start, comparison_api_end=end,
        gross_fees_usd=str(gross), distribution_fees_usd=str(distribution),
        protocol_fees_residual_usd=str(gross - distribution), api_fees_usd=str(api_fees),
        unverified_dune_source=fee_capture['url'], unaligned_aggregate_difference_usd=str(gap)))

    for key, filename, names, label, caveat in [
        ('defi-mix', 'protocol-mix-dune.json', ['Rhea Lend', 'Rhea Dex'], 'Rhea Lend and Rhea Dex',
         'Share of the tracked product roster, not unique deposited dollars; intraday composition differs from daily chain TVL.'),
        ('stablecoin-mix', 'stablecoin-mix-dune.json', ['USDC', 'USDT'], 'USDC and USDT',
         'Price-adjusted tracked balances; native and bridged forms may be aggregated.')]:
        data, total = rows(filename, 'value_usd')
        assert set(names) <= {row['name'] for row in data}
        selected = sum(D(row['value_usd']) for row in data if row['name'] in names)
        share = selected / total * 100
        query_id = read(filename)['query_id']
        cutoff = data[0]['retrieved_utc'] + ' UTC snapshot'
        assert all(row['retrieved_utc'] == data[0]['retrieved_utc'] for row in data)
        add(key, f'{share:.1f}%', f'{label} account for {share:.1f}% of tracked balances.', cutoff, caveat,
            f'https://dune.com/queries/{query_id}',
            dict(method='Sum named balances / sum all tracked balances × 100', names=names,
                 selected_usd=str(selected), total_usd=str(total), share_pct=str(share)))

    for key, filename, value_column, names, headline, caveat in [
        ('chain-mix', 'chain-mix-dune.json', 'volume_usd', ['eth'], 'The Ethereum label accounts for {share:.1f}% of reported Intents volume.',
         'Provider chain labels, not proof of NEAR L1 settlement or independent users.'),
        ('token-mix', 'token-mix-dune.json', 'volume_usd', ['USDT', 'USDC'], 'USDT and USDC account for {share:.1f}% of reported Intents volume.',
         'Provider token-symbol labels may combine distinct assets or contracts.'),
        ('distribution', 'referral-mix-dune.json', 'fees_usd', ['swapkit'], 'The swapkit label accounts for {share:.1f}% of distribution fees.',
         'Fee share, not volume or user share. Referral labels are not beneficial-owner identities; excludes separate protocol fees.')]:
        data, total = rows(filename, value_column)
        assert set(names) <= {row['name'] for row in data}
        assert all(start <= row['first_date'][:10] <= row['last_date'][:10] <= end for row in data)
        selected = sum(D(row[value_column]) for row in data if row['name'] in names)
        share = selected / total * 100
        if value_column == 'volume_usd':
            assert abs(total - volume) < 1, 'Breakdown and API volume must reconcile within rounding'
        else:
            assert abs(total - distribution) < D('.01'), 'Distribution fees must reconcile with fee capture'
        add(key, f'{share:.1f}%', headline.format(share=share), period, caveat, read(filename)['url'],
            dict(method='Sum named labels / sum all labels × 100', names=names, start=start, end=end,
                 selected_usd=str(selected), total_usd=str(total), share_pct=str(share)))

    activity_capture = read('activity-dune.json')
    header, *body = activity_capture['rows']
    activity = sorted([dict(zip(header, row, strict=True)) for row in body], key=lambda r: r['block_date'])
    days = [r['block_date'][:10] for r in activity]
    assert len(days) == len(set(days)) == 7
    assert (date.fromisoformat(days[-1]) - date.fromisoformat(days[0])).days == 6
    for row in activity:
        assert int(row['observed_dates']) == 7 and row['latest_observed_date'][:10] == days[-1]
        assert int(row['missing_origin_transactions']) == int(row['inconsistent_origin_transactions']) == 0
        assert 0 <= int(row['transaction_origin_accounts']) <= int(row['observed_transactions'])
        assert 0 <= int(row['delegated_transactions']) <= int(row['observed_transactions'])
    average = sum(D(r['observed_transactions']) for r in activity) / 7
    assert all(abs(D(r['avg_daily_observed_transactions_7d']) - average) < D('.000001') for r in activity)
    latest = activity[-1]
    add('base-activity', f'{average:,.0f}', 'Observed transactions per day across seven completed UTC dates.',
        days[0] + '–' + days[-1] + ' · 7 completed UTC days',
        'Receipt-date transaction counts include all outcomes. A transaction can appear on multiple dates; origin accounts include relayers, not people.',
        activity_capture['url'], dict(method='Deduplicate transaction hashes per receipt-execution date; average seven daily counts',
        start=days[0], end=days[-1], daily_average_transactions=str(average),
        daily_transactions={r['block_date'][:10]: r['observed_transactions'] for r in activity},
        latest_transactions=latest['observed_transactions'], latest_origin_accounts=latest['transaction_origin_accounts'],
        missing_origin_transactions=0, inconsistent_origin_transactions=0))

    supply_capture = read('supply-dune.json')
    header, *body = supply_capture['rows']
    assert len(body) == 1
    supply = dict(zip(header, body[0], strict=True))
    assert not supply['rpc_error'] and int(supply['block_height']) > 0 and supply['block_hash']
    amount = D(supply['total_supply_yoctonear']) / D(10 ** 24)
    assert amount > 0 and abs(amount - D(supply['total_supply_near'])) < D('.000001')
    observed = datetime.fromtimestamp(int(supply['timestamp_nanosec']) // 10 ** 9, timezone.utc).isoformat()
    add('total-supply', f'{amount / 1000000000:.3f}bn NEAR', 'Total native supply at the observed finalized block.',
        observed, 'Total supply is not circulating, unlocked or liquid supply. One RPC observation; no independent provider reconciliation.',
        supply_capture['url'], dict(method='Finalized block header total_supply / 10^24; pin block_id to reproduce',
        block_height=supply['block_height'], block_hash=supply['block_hash'], timestamp_nanosec=supply['timestamp_nanosec'],
        total_supply_yoctonear=supply['total_supply_yoctonear'], total_supply_near=str(amount),
        pinned_rpc_request={'jsonrpc': '2.0', 'id': 'token-overview', 'method': 'block', 'params': {'block_id': int(supply['block_height'])}}))

    revenue, ecosystem = read('ir-revenue.json'), read('ir-ecosystem.json')

    def series(payload, path, name):
        chart = payload
        for part in path.split('.'):
            chart = chart[part]
        values = next(s['data'] for s in chart['series'] if s['name'] == name)
        assert len(chart['dates']) == len(values) and len(set(chart['dates'])) == len(values)
        result = {day: D(str(value)) for day, value in zip(chart['dates'], values) if value is not None}
        assert result and all(v.is_finite() and v >= 0 for v in result.values())
        return result

    def ir_add(key, value, headline, payload, snapshot, inputs, method, limitation):
        cutoff = inputs['end']
        add(key, value, headline, cutoff + ' UTC · frozen source observation', limitation,
            'https://defillama.com/api/public/near/' + payload,
            dict(method=method, **inputs))
        insights[key]['snapshot'] = 'data/glance-sources/' + snapshot

    fees = series(revenue, 'fees.feesChart', 'Intent Fees')
    native_fees = series(revenue, 'fees.feesChart', 'Protocol Fees')
    receipts = series(revenue, 'revenue.revenueChart', 'Intents Revenue')
    burn = series(revenue, 'revenue.revenueChart', 'Protocol Revenue (70% Burned)')
    emissions = series(revenue, 'emissions.revenueVsEmissionsChart', 'Daily Emissions')
    end = max(fees)
    start = (date.fromisoformat(end) - timedelta(days=29)).isoformat()
    days = [(date.fromisoformat(start) + timedelta(days=i)).isoformat() for i in range(30)]
    assert all(day in p for p in [fees, native_fees, receipts, burn, emissions] for day in days)
    fee_total = sum(fees.values()) + sum(native_fees.values())
    revenue_total = sum(receipts.values()) + sum(burn.values())
    fees_30d = sum(fees[d] + native_fees[d] for d in days)
    revenue_30d = sum(receipts[d] + burn[d] for d in days)
    emission_30d = sum(emissions[d] for d in days)
    assert abs(fee_total - D(str(revenue['fees']['kpis']['allTimeFees']['value']))) < D('.000001')
    assert abs(revenue_total - D(str(revenue['revenue']['kpis']['allTimeRevenue']['value']))) < D('.000001')
    revenue_note = 'NEAR-equivalent provider accounting: wallet receipts plus the source’s gas-burn classification. Not tokenholder cash income or independently verified buybacks.'
    def rev(key, value, headline, inputs, method):
        ir_add(key, value, headline, 'revenue', 'ir-revenue.json', dict(end=end, **inputs), method, revenue_note)
    rev('ir-fees', f'{fees_30d / 1000000:.2f}m NEAR', 'Fees generated across the last 30 completed source dates.',
        dict(start=start, fees_near=str(fees_30d), provider_30d_kpi_near=str(revenue['fees']['kpis']['thirtyDayFees']['value'])), 'Sum daily Intents fees + protocol fees across the stated 30-date window. The separately reported 30-day KPI differs; its window is not reconciled.')
    rev('ir-revenue', f'{revenue_30d / 1000:.1f}k NEAR', 'Captured revenue over 30 completed source dates.',
        dict(start=start, revenue_near=str(revenue_30d), provider_30d_kpi_near=str(revenue['revenue']['kpis']['thirtyDayRevenue']['value'])), 'Sum daily Intents receipts + provider-classified gas burn across the stated window. The separately reported 30-day KPI differs; its window is not reconciled.')
    share = sum(fees.values()) / fee_total * 100
    rev('ir-fee-sources', f'{share:.1f}%', 'Intents accounts for this share of cumulative fees in NEAR equivalents.',
        dict(intents_fees_near=str(sum(fees.values())), total_fees_near=str(fee_total)), 'Cumulative Intents fees / cumulative total fees × 100.')
    rev('ir-cumulative', f'{revenue_total / 1000000:.2f}m NEAR', 'Cumulative captured revenue, alongside total fees of ' + f'{fee_total / 1000000:.2f}m NEAR.',
        dict(revenue_near=str(revenue_total), fees_near=str(fee_total)), 'Sum each daily revenue component across the complete source history.')
    latest_revenue = receipts[end] + burn[end]
    gap = emissions[end] - latest_revenue
    rev('ir-emissions', f'{gap / 1000:.1f}k NEAR', 'Latest daily issuance exceeded captured revenue by this amount.',
        dict(emissions_near=str(emissions[end]), revenue_near=str(latest_revenue)), 'Daily emissions − daily captured revenue. This accounting comparison is not net supply issuance.')
    coverage = revenue_30d / emission_30d * 100
    rev('ir-coverage', f'{coverage:.1f}%', 'Captured revenue covered this share of issuance across 30 source dates.',
        dict(start=start, revenue_near=str(revenue_30d), emissions_near=str(emission_30d)), 'Sum revenue / sum emissions × 100; not the average of daily percentages.')
    wallets = revenue['revenue']['walletBreakdown']['wallets']
    wallet_total = sum(D(str(w['total'])) for w in wallets)
    wallet = max(wallets, key=lambda w: w['total'])
    wallet_share = D(str(wallet['total'])) / wallet_total * 100
    rev('ir-wallets', f'{wallet_share:.1f}%', 'Intents receipts dominate the source’s trailing-year revenue mix.',
        dict(window='Last 12 months, provider-defined', label=wallet['wallet'], selected_near=str(wallet['total']), total_near=str(wallet_total)), 'Named wallet classification / sum all revenue wallet classifications × 100.')

    def eco(key, path, names, value, headline, limitation, method):
        points = [series(ecosystem, path, name) for name in names]
        last = min(max(p) for p in points)
        inputs = {name: str(p[last]) for name, p in zip(names, points)}
        ir_add(key, value([p[last] for p in points]), headline, 'ecosystem', 'ir-ecosystem.json',
            dict(end=last, inputs=inputs), method, limitation)
    eco('ir-transactions', 'ecosystem.txnsChart', ['Transactions'], lambda v: f'{v[0]:,.0f}',
        'Transactions on the latest completed source date.', 'Provider-reported base-chain transactions, not unique users or Intents swaps.', 'Read the latest daily Transactions observation.')
    eco('ir-accounts', 'ecosystem.activeAccountsChart', ['Active Accounts'], lambda v: f'{v[0]:,.0f}',
        'Active accounts on the latest completed source date.', 'Accounts can include bots, relayers and multiple identities belonging to one entity.', 'Read the latest daily Active Accounts observation; do not sum daily counts into monthly unique accounts.')
    eco('ir-gas', 'ecosystem.gasChart', ['Gas Fees'], lambda v: f'{v[0]:,.0f} NEAR',
        'Base-chain gas fees on the latest completed source date.', 'Native gas fees only; separate from cross-chain Intents service fees.', 'Read the latest Gas Fees observation, denominated in NEAR.')
    eco('ir-price', 'tokenEconomics.priceChart', ['Price'], lambda v: f'${v[0]:.4f}',
        'NEAR’s price at the source cutoff.', 'A historical provider price, not a live quote or a valuation conclusion.', 'Read the latest Price observation, denominated in USD.')
    eco('ir-supply', 'tokenEconomics.supplyChart', ['Total Supply', 'Circulating Supply'], lambda v: f'{(v[0]-v[1])/1000000:.1f}m NEAR',
        'The gap between total and circulating supply at the source cutoff.', 'Provider supply definitions; the difference is not a verified vesting or tradable-float estimate.', 'Total Supply − Circulating Supply on the same source date.')
    eco('ir-volume', 'intents.volumeChart', ['Daily Volume'], lambda v: f'${v[0]/1000000:.1f}m',
        'Intents trading notional on the latest completed source date.', 'Cross-chain service volume, not NEAR L1 settlement or token demand.', 'Read the latest Daily Volume observation in USD.')
    eco('ir-swaps', 'intents.activityChart', ['Daily Swaps'], lambda v: f'{v[0]:,.0f}',
        'Intents swaps on the latest completed source date.', 'Swaps are not users. The source’s totalSwaps and cumulativeSwaps fields disagree.', 'Read the latest Daily Swaps observation; cumulative fields are not used.')
    eco('ir-intents-fees', 'intents.feesChart', ['Daily Fees'], lambda v: f'${v[0]:,.0f}',
        'Intents service fees on the latest completed source date.', 'Gross service fees in USD, not revenue paid to NEAR holders.', 'Read the latest Daily Fees observation in USD.')
    for key, path, label in [('ir-chains', 'intents.blockchainBreakdown', 'blockchain'), ('ir-tokens', 'intents.tokenBreakdown', 'token')]:
        chart = ecosystem['intents'][path.split('.')[-1]]
        last = max(chart['dates'])
        first = (date.fromisoformat(last) - timedelta(days=29)).isoformat()
        indices = [i for i, day in enumerate(chart['dates']) if first <= day <= last]
        assert len(indices) == 30
        totals = {s['name']: sum(D(str(s['data'][i] or 0)) for i in indices) for s in chart['series']}
        name = max(totals, key=totals.get)
        total = sum(totals.values())
        share = totals[name] / total * 100
        ir_add(key, f'{share:.1f}%', f'{name} is the largest {label} label in the 30-day Intents volume mix.',
            'ecosystem', 'ir-ecosystem.json', dict(start=first, end=last, label=name, selected_usd=str(totals[name]), total_usd=str(total), observed_dates=len(indices)),
            'Sum named label volume / sum all labels × 100 over the stated 30-day window.', 'Token and blockchain mixes describe the same activity; do not add them. Labels are provider-defined, not verified entities.')
    channels = ecosystem['intents']['channelBreakdown']['channels']
    channel_total = sum(D(str(c['fees'])) for c in channels)
    channel = max(channels, key=lambda c: c['fees'])
    channel_share = D(str(channel['fees'])) / channel_total * 100
    ir_add('ir-channels', f'{channel_share:.1f}%', f'{channel["referral"]} accounts for this share of reported channel fees.',
        'ecosystem', 'ir-ecosystem.json', dict(end=ecosystem['intents']['feesChart']['dates'][-1], window='All time, provider-defined', label=channel['referral'], selected_usd=str(channel['fees']), total_usd=str(channel_total)),
        'Named channel fees / sum all reported channel fees × 100.', 'All-time referral-fee mix, not user or volume share. Its total differs from the source’s total Intents fees.')
    assert len(insights) == 29
    assert insights['defi-capital']['value'] == '$208.9m'
    assert insights['stablecoins']['value'] == '$128.6m'
    assert insights['distribution']['value'] == '56.8%'
    return dict(version='glance-insights-2026-11-06-v3',
                methodology='Frozen observations; rerunning calculations does not refresh sources. Date cutoffs differ by metric. Current Dune embeds can differ. No causal or tokenholder-income claim.',
                sources=manifest, insights=insights)


if __name__ == '__main__':
    output = json.dumps(build(), indent=2, ensure_ascii=False) + '\n'
    if '--check' in sys.argv:
        assert OUTPUT.read_text(encoding='utf-8') == output, 'Insight output is stale; rerun analysis/glance-insights.py'
        print('PASS: 29 insights, source hashes, date windows, distributions, supply units and activity averages.')
    else:
        OUTPUT.write_text(output, encoding='utf-8', newline='\n')
        print('Wrote data/glance-insights.json from frozen source snapshots.')
