import hashlib
import json
import sys
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal, getcontext
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCES = ROOT / 'data/glance-sources'
OUTPUT = ROOT / 'data/glance-economics.json'
FILES = ['intents-scorecard-dune.json', 'intents-waterfall-dune.json', 'intents-retention-dune.json',
         'defillama-api-intents.json']
D = Decimal
getcontext().prec = 50


def read(name):
    return json.loads((SOURCES / name).read_text(encoding='utf-8'))


def day(timestamp):
    return datetime.fromtimestamp(int(timestamp), timezone.utc).date().isoformat()


def series(points):
    result = {}
    for timestamp, value in points:
        key = day(timestamp)
        assert key not in result
        result[key] = D(str(value))
    return result


def window(start, end):
    first, last = date.fromisoformat(start), date.fromisoformat(end)
    return [(first + timedelta(days=i)).isoformat() for i in range((last - first).days + 1)]


def total(values, days):
    assert all(d in values for d in days), 'missing dates'
    return sum(values[d] for d in days)


def pct(a, b):
    return ((a / b - 1) * 100).quantize(D('0.001'))


def build():
    hashes = {name: hashlib.sha256((SOURCES / name).read_bytes()).hexdigest() for name in FILES}
    score = read('intents-scorecard-dune.json')['rows']
    assert len(score) == 1
    s = {k: (D(str(v)) if isinstance(v, (int, float)) else v) for k, v in score[0].items()}
    assert s['days_covered'] == 30 and s['volume_usd'] > 0
    assert abs(s['gross_fees_usd'] - s['paid_out_usd'] - s['retained_usd']) < 1
    start, end = s['window_start'][:10], s['window_end'][:10]
    days = window(start, end)
    assert len(days) == 30

    waterfall = read('intents-waterfall-dune.json')['rows']
    steps = {row['step']: D(str(row['usd_per_1m'])) for row in waterfall}
    assert abs(steps['Gross fees'] + steps['Paid out'] - steps['Retained by protocol']) < D('0.01')

    monthly = []
    for row in read('intents-retention-dune.json')['rows']:
        monthly.append(dict(month=row['month'][:7], partial=row['partial_month'], volume_usd=round(row['volume_usd']),
                            gross_bps=round(row['gross_bps'], 2), retained_bps=round(row['retained_bps'], 2),
                            retained_share_pct=round(row['retained_share_pct'], 1)))
    complete = [m for m in monthly if not m['partial']]
    first_month, last_month = complete[0], complete[-1]

    llama = read('defillama-api-intents.json')
    api = {key: series(llama[key]['totalDataChart']) for key in ('volume', 'fees', 'revenue')}
    api_volume, api_fees, api_revenue = (total(api[k], days) for k in ('volume', 'fees', 'revenue'))

    checks = [
        dict(metric='Intents volume, 30 days', primary='Dune scorecard', primary_value=str(s['volume_usd']),
             reference='DefiLlama API', reference_value=str(api_volume), difference_pct=str(pct(s['volume_usd'], api_volume)), window=f'{start} to {end}'),
        dict(metric='Intents gross fees, 30 days', primary='Dune scorecard', primary_value=str(s['gross_fees_usd']),
             reference='DefiLlama API', reference_value=str(api_fees), difference_pct=str(pct(s['gross_fees_usd'], api_fees)), window=f'{start} to {end}'),
        dict(metric='Intents retained revenue, 30 days', primary='Dune scorecard', primary_value=str(s['retained_usd']),
             reference='DefiLlama API', reference_value=str(api_revenue), difference_pct=str(pct(s['retained_usd'], api_revenue)), window=f'{start} to {end}'),
    ]
    for check in checks:
        assert abs(D(check['difference_pct'])) < D('0.1'), check['metric']

    observed = dict(
        window=dict(start=start, end=end, days=30),
        scorecard=dict(volume_usd=str(s['volume_usd']), swaps=str(s['swaps']), avg_swap_usd=str(s['avg_swap_usd']),
                       gross_fees_usd=str(s['gross_fees_usd']), paid_out_usd=str(s['paid_out_usd']), retained_usd=str(s['retained_usd']),
                       retained_share_pct=str(100 * s['retained_usd'] / s['gross_fees_usd']),
                       retained_share_near_pct=str(s.get('retained_share_near_pct', s['retained_share_pct'])), gross_bps=str(s['gross_bps']), retained_bps=str(s['retained_bps']),
                       retained_per_1m_usd=str(s['retained_per_1m_usd']), revenue_pct_issuance=str(s['revenue_pct_issuance']),
                       avg_daily_transactions=str(s['avg_daily_transactions'])),
        waterfall=[dict(step=k, usd_per_1m=str(v)) for k, v in steps.items()],
        monthly=monthly,
        trend=dict(first=first_month, last=last_month),
        institutional=dict(pending=['Holdings in exchange-traded products', 'Holdings of listed treasury companies'],
                           unavailable=['Institutional order flow routed through Intents', 'Agent-originated Intents volume', 'Active executing solvers']),
        checks=checks)
    return dict(version='glance-economics-2026-11-12-v3', sources={k: dict(sha256=v) for k, v in hashes.items()}, observed=observed)


if __name__ == '__main__':
    output = json.dumps(build(), indent=2, ensure_ascii=False) + '\n'
    if '--check' in sys.argv:
        assert OUTPUT.read_text(encoding='utf-8') == output, 'Economics output is stale; rerun analysis/glance-economics.py'
        print('PASS: Intents economics reconcile with the DefiLlama API snapshot.')
    else:
        OUTPUT.write_text(output, encoding='utf-8', newline='\n')
        print('Wrote data/glance-economics.json')
