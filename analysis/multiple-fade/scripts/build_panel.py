import sys, os, json, glob, hashlib, datetime as dt, calendar
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from universe import UNIVERSE
RAW, OUT = (sys.argv[1], sys.argv[2])
DAY = 86400
resolved = json.load(open(os.path.join(RAW, 'resolved.json')))

def load_llama(slug, dtype):
    p = os.path.join(RAW, 'llama', f"{slug.replace('.', '_')}__{dtype}.json")
    if not os.path.exists(p):
        return None
    try:
        d = json.load(open(p))
    except Exception:
        return None
    ch = d.get('totalDataChart') or []
    out = {}
    for ts, v in ch:
        out[int(ts) // DAY] = float(v or 0)
    return out or None

def load_cmc(cid):
    out = {}
    for p in sorted(glob.glob(os.path.join(RAW, 'cmc', f'{cid}_*.json'))):
        try:
            d = json.load(open(p))
            qs = d['data']['quotes']
        except Exception:
            continue
        for q in qs:
            day = int(dt.datetime.strptime(q['timeOpen'][:10], '%Y-%m-%d').replace(tzinfo=dt.timezone.utc).timestamp()) // DAY
            mc = q['quote'].get('marketCap') or 0
            out[day] = (float(mc), float(q['quote'].get('circulatingSupply') or 0), float(q['quote'].get('close') or 0))
    return out
MCAP_MODE = {'dYdX': 'last'}

def mcap_at(series_list, day, mode='sum'):
    if mode == 'last':
        for s in reversed(series_list):
            v = mcap_at([s], day)
            if v:
                return v
        return None
    tot, n = (0.0, 0)
    for s in series_list:
        for k in range(0, 5):
            v = s.get(day - k)
            if v and v[0] > 0:
                tot += v[0]
                n += 1
                break
    return tot if n else None

def month_ends(y0=2018, m0=12, y1=2026, m1=10):
    out = []
    y, m = (y0, m0)
    while (y, m) <= (y1, m1):
        d = dt.date(y, m, calendar.monthrange(y, m)[1])
        out.append(d)
        m += 1
        if m == 13:
            y, m = (y + 1, 1)
    return out

def window_stats(series, day):
    if series is None:
        return None
    first = min(series)
    days = range(day - 364, day + 1)
    vals = [series.get(d) for d in days]
    nrec = sum((v is not None for v in vals))
    tot = sum((v for v in vals if v))
    blocks = 0
    for b in range(12):
        seg = vals[b * 30 + 5:(b + 1) * 30 + 5] if b < 11 else vals[335:365]
        if sum((v for v in seg if v)) > 0:
            blocks += 1
    return {'rev365': tot, 'nrec': nrec, 'full': first <= day - 364, 'pos_blocks': blocks}
ME = month_ends()
rows = []
meta = {}
for name, group, slugs, cmc_ids in UNIVERSE:
    r = resolved.get(name) or {}
    slug = r.get('llama_slug')
    if not slug:
        meta[name] = {'group': group, 'status': 'no DefiLlama revenue series'}
        continue
    rev = load_llama(slug, 'dailyRevenue')
    hold = load_llama(slug, 'dailyHoldersRevenue')
    fees = load_llama(slug, 'dailyFees')
    cm = [load_cmc(c) for c in cmc_ids]
    if not any(cm):
        meta[name] = {'group': group, 'status': 'no CMC data'}
        continue
    first_rev = min(rev) if rev else None
    meta[name] = {'group': group, 'slug': slug, 'cmc_ids': cmc_ids, 'rev_series_start': str(dt.date(1970, 1, 1) + dt.timedelta(days=first_rev)) if rev else None, 'first_nonzero_rev': str(dt.date(1970, 1, 1) + dt.timedelta(days=min((k for k, v in rev.items() if v > 0)))) if rev and any((v > 0 for v in rev.values())) else None, 'cmc_start': [str(dt.date(1970, 1, 1) + dt.timedelta(days=min(s))) if s else None for s in cm]}
    for d in ME:
        day = (d - dt.date(1970, 1, 1)).days
        mc = mcap_at(cm, day, MCAP_MODE.get(name, 'sum'))
        w = window_stats(rev, day)
        if w is None or not w['full']:
            continue
        wh = window_stats(hold, day) if hold else None
        wf = window_stats(fees, day) if fees else None
        rows.append({'entity': name, 'group': group, 'date': str(d), 'mcap': mc, 'rev365': w['rev365'], 'nrec': w['nrec'], 'pos_blocks': w['pos_blocks'], 'hold365': wh['rev365'] if wh and wh['full'] else None, 'fees365': wf['rev365'] if wf and wf['full'] else None})
os.makedirs(OUT, exist_ok=True)
json.dump(rows, open(os.path.join(OUT, 'panel.json'), 'w'))
json.dump(meta, open(os.path.join(OUT, 'panel_meta.json'), 'w'), indent=1)
hashes = {}
for p in sorted(glob.glob(os.path.join(RAW, '**', '*'), recursive=True)):
    if os.path.isfile(p):
        hashes[os.path.relpath(p, RAW)] = hashlib.sha256(open(p, 'rb').read()).hexdigest()
json.dump(hashes, open(os.path.join(OUT, 'raw_sha256.json'), 'w'), indent=0)
print(len(rows), 'rows;', len(meta), 'entities')
