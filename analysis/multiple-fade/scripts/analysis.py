import sys, os, json, math, datetime as dt
from collections import defaultdict
import numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from rules import RULES
OUT = sys.argv[1]
rows = json.load(open(os.path.join(OUT, 'panel.json')))
meta = json.load(open(os.path.join(OUT, 'panel_meta.json')))
RNG = np.random.default_rng(42)
NBOOT = 2000
BREAKS = {'Uniswap': '2025-12-29', 'Ethereum': '2021-08-05', 'dYdX': '2023-10-26', 'Solana': '2025-02-13'}

def mkey(d):
    y, m = (int(d[:4]), int(d[5:7]))
    return y * 12 + m - 1

def passes(r, spec):
    if r['mcap'] is None or r['mcap'] < 10000000.0:
        return False
    den = r[spec.get('den', 'rev365')]
    if den is None:
        return False
    if r['nrec'] < 330:
        return False
    if spec.get('loose'):
        return den > 0
    if den < spec.get('floor', 1000000.0):
        return False
    if r['pos_blocks'] < 11:
        return False
    if spec.get('breaks') and r['entity'] in BREAKS:
        b = dt.date.fromisoformat(BREAKS[r['entity']])
        d = dt.date.fromisoformat(r['date'])
        if b <= d < b + dt.timedelta(days=365):
            return False
    return True

def collapse(r, spec):
    if r['mcap'] is None or r['mcap'] < 10000000.0 or r['nrec'] < 330:
        return False
    return not passes(r, spec)
SPECS = {'primary': {}, 'loose_no_E2_E3': {'loose': True}, 'floor_5M': {'floor': 5000000.0}, 'manual_breaks_E5': {'breaks': True}, 'holders_revenue_den': {'den': 'hold365'}, 'fees_den': {'den': 'fees365'}}

def build(spec, groups):
    idx = {}
    for r in rows:
        if r['group'] in groups:
            idx[r['entity'], mkey(r['date'])] = r
    obs = {k: math.log(r['mcap'] / r[spec.get('den', 'rev365')]) for k, r in idx.items() if passes(r, spec)}
    return (idx, obs)

def ols(x, y):
    x = np.asarray(x)
    y = np.asarray(y)
    X = np.column_stack([np.ones_like(x), x])
    beta, *_ = np.linalg.lstsq(X, y, rcond=None)
    return beta

def hl(b):
    return math.log(0.5) / math.log(b) if 0 < b < 1 else float('inf')

def ar1(obs, lag=12, relative=False, december_only=False, winsor=False):
    vals = dict(obs)
    if winsor and vals:
        arr = np.array(list(vals.values()))
        lo, hi = np.percentile(arr, [1, 99])
        vals = {k: min(max(v, lo), hi) for k, v in vals.items()}
    if relative:
        bydate = defaultdict(list)
        for (e, m), v in vals.items():
            bydate[m].append(v)
        means = {m: np.mean(v) for m, v in bydate.items() if len(v) >= 3}
        vals = {(e, m): v - means[m] for (e, m), v in vals.items() if m in means}
    pairs = defaultdict(list)
    for (e, m), v in vals.items():
        if december_only and m % 12 != 11:
            continue
        w = vals.get((e, m + lag))
        if w is not None:
            pairs[e].append((v, w))
    ents = sorted(pairs)
    if len(ents) < 3:
        return {'n_pairs': sum((len(p) for p in pairs.values())), 'n_entities': len(ents), 'note': 'too few'}
    allp = [p for e in ents for p in pairs[e]]
    a, b = ols([p[0] for p in allp], [p[1] for p in allp])
    bs, lrs = ([], [])
    for _ in range(NBOOT):
        pick = RNG.choice(len(ents), len(ents), replace=True)
        pp = [p for i in pick for p in pairs[ents[i]]]
        aa, bb = ols([p[0] for p in pp], [p[1] for p in pp])
        bs.append(bb)
        lrs.append(math.exp(min(aa / (1 - bb), 50)) if bb < 1 else float('nan'))
    bs = np.array(bs)
    per_year = b ** (12 / lag)
    hl_boot = np.array([hl(x ** (12 / lag)) for x in bs])
    out = {'n_pairs': len(allp), 'n_entities': len(ents), 'b': round(float(b), 4), 'b_per_year': round(float(per_year), 4), 'b_ci95': [round(float(np.percentile(bs, 2.5)), 4), round(float(np.percentile(bs, 97.5)), 4)], 'half_life_years': round(hl(per_year), 2), 'half_life_ci95': [round(float(np.percentile(hl_boot, 2.5)), 2), round(float(np.percentile(hl_boot, 97.5)), 2) if np.isfinite(np.percentile(hl_boot, 97.5)) else 'inf'], 'share_boot_b_ge_1': round(float((bs >= 1).mean()), 4)}
    if not relative:
        out['long_run_multiple'] = round(math.exp(a / (1 - b)), 1) if b < 1 else None
        lr = np.array(lrs)
        lr = lr[np.isfinite(lr)]
        out['long_run_multiple_ci95'] = [round(float(np.percentile(lr, 2.5)), 1), round(float(np.percentile(lr, 97.5)), 1)] if len(lr) else None
    return out

def transitions(idx, obs, spec, thr, h_years):
    h = 12 * h_years
    starts = [(k, v) for k, v in obs.items() if math.exp(v) > thr]
    fut, coll, n_trunc = ([], [], 0)
    per_ent = defaultdict(list)
    for (e, m), v in starts:
        r2 = idx.get((e, m + h))
        if (e, m + h) in obs:
            fv = math.exp(obs[e, m + h])
            fut.append((e, fv))
            per_ent[e].append(fv)
        elif r2 is not None and collapse(r2, spec):
            coll.append(e)
            per_ent[e].append(float('inf'))
        else:
            n_trunc += 1
    vals = np.array([f for _, f in fut])
    res = {'threshold': thr, 'horizon_years': h_years, 'n_start_obs': len(starts), 'n_start_entities': len({e for (e, _), _ in starts}), 'n_outcomes': len(vals), 'n_outcome_entities': len({e for e, _ in fut}), 'n_revenue_collapse': len(coll), 'n_no_future_data': n_trunc}
    if len(vals):
        res.update({'median': round(float(np.median(vals)), 1), 'q1': round(float(np.percentile(vals, 25)), 1), 'q3': round(float(np.percentile(vals, 75)), 1), 'share_gt_100': round(float((vals > 100).mean()), 3), 'share_gt_50': round(float((vals > 50).mean()), 3), 'share_gt_100_conservative': round(float(((vals > 100).sum() + len(coll)) / (len(vals) + len(coll))), 3)})
        ents = sorted(per_ent)
        w_vals = [(v, 1 / len(per_ent[e])) for e in ents for v in per_ent[e] if np.isfinite(v)]
        if w_vals:
            ws = sorted(w_vals)
            cw = np.cumsum([w for _, w in ws])
            cw /= cw[-1]
            res['median_entity_weighted'] = round(float(ws[int(np.searchsorted(cw, 0.5))][0]), 1)
        meds, shares = ([], [])
        for _ in range(NBOOT):
            pick = RNG.choice(len(ents), len(ents), replace=True)
            vv = np.array([v for i in pick for v in per_ent[ents[i]] if np.isfinite(v)])
            if len(vv):
                meds.append(np.median(vv))
                shares.append((vv > 100).mean())
        res['median_ci95_cluster'] = [round(float(np.percentile(meds, 2.5)), 1), round(float(np.percentile(meds, 97.5)), 1)]
        res['share_gt_100_ci95_cluster'] = [round(float(np.percentile(shares, 2.5)), 3), round(float(np.percentile(shares, 97.5)), 3)]
        res['outcome_entities'] = sorted({e for e, _ in fut})
    return res

def cross_section(obs, month):
    v = sorted((math.exp(x) for (e, m), x in obs.items() if m == month))
    if not v:
        return None
    a = np.array(v)
    return {'n': len(v), 'median': round(float(np.median(a)), 1), 'q1': round(float(np.percentile(a, 25)), 1), 'q3': round(float(np.percentile(a, 75)), 1)}
results = {'generated_utc': dt.datetime.utcnow().strftime('%Y-%m-%dT%H:%M:%SZ'), 'rules': RULES, 'entities': meta, 'groups': {}}
GROUPS = {'protocol': {'protocol'}, 'l1': {'l1'}, 'l2': {'l2'}}
for gname, gset in GROUPS.items():
    G = {}
    for sname, spec in SPECS.items():
        if sname == 'holders_revenue_den' and gname != 'protocol':
            continue
        idx, obs = build(spec, gset)
        S = {'n_obs': len(obs), 'n_entities': len({e for e, _ in obs}), 'entities_used': sorted({e for e, _ in obs})}
        S['ar1_primary'] = ar1(obs)
        S['ar1_relative_to_date_mean'] = ar1(obs, relative=True)
        S['ar1_december_only'] = ar1(obs, december_only=True)
        if sname == 'primary':
            S['ar1_winsorised'] = ar1(obs, winsor=True)
            S['ar1_lag24'] = ar1(obs, lag=24)
            S['ar1_lag36'] = ar1(obs, lag=36)
            S['cross_section_by_dec'] = {str(y): cross_section(obs, y * 12 + 11) for y in range(2019, 2026)}
            S['cross_section_2026_10'] = cross_section(obs, 2026 * 12 + 9)
            allm = np.exp(np.array(list(obs.values())))
            S['pooled_all_obs'] = {'median': round(float(np.median(allm)), 1), 'q1': round(float(np.percentile(allm, 25)), 1), 'q3': round(float(np.percentile(allm, 75)), 1), 'share_gt_100': round(float((allm > 100).mean()), 3)}
        T = {}
        for thr in (50, 100):
            for hy in (1, 2, 3, 5):
                T[f'>{thr}x_h{hy}y'] = transitions(idx, obs, spec, thr, hy)
        S['transitions'] = T
        G[sname] = S
    results['groups'][gname] = G

def elasticity_and_decomp(groups, spec):
    idx, obs = build(spec, groups)
    pairs = defaultdict(list)
    dec = []
    for (e, m), v in obs.items():
        if (e, m + 12) in obs:
            r0, r1 = (idx[e, m], idx[e, m + 12])
            dm = math.log(r1['mcap'] / r0['mcap'])
            dr = math.log(r1['rev365'] / r0['rev365'])
            pairs[e].append((dr, dm))
            if math.exp(v) > 100:
                dec.append((e, dm, dr))
    ents = sorted(pairs)
    if len(ents) < 3:
        return None
    allp = [p for e in ents for p in pairs[e]]
    a, b = ols([p[0] for p in allp], [p[1] for p in allp])
    bs = []
    for _ in range(NBOOT):
        pick = RNG.choice(len(ents), len(ents), replace=True)
        pp = [p for i in pick for p in pairs[ents[i]]]
        bs.append(ols([p[0] for p in pp], [p[1] for p in pp])[1])
    corr = float(np.corrcoef([p[0] for p in allp], [p[1] for p in allp])[0, 1])
    out = {'elasticity_mcap_on_revenue_12m': round(float(b), 3), 'ci95': [round(float(np.percentile(bs, 2.5)), 3), round(float(np.percentile(bs, 97.5)), 3)], 'corr': round(corr, 3), 'n_pairs': len(allp), 'n_entities': len(ents)}
    if dec:
        dm = np.array([d[1] for d in dec])
        dr = np.array([d[2] for d in dec])
        out['starts_gt_100x_12m_decomposition'] = {'n': len(dec), 'n_entities': len({d[0] for d in dec}), 'median_dlog_mcap': round(float(np.median(dm)), 3), 'median_dlog_rev': round(float(np.median(dr)), 3), 'mean_dlog_mcap': round(float(dm.mean()), 3), 'mean_dlog_rev': round(float(dr.mean()), 3), 'mean_dlog_multiple': round(float((dm - dr).mean()), 3)}
    return out
for gname, gset in (('protocol', {'protocol'}), ('l1', {'l1'})):
    results['groups'][gname]['primary']['elasticity_decomposition'] = elasticity_and_decomp(gset, {})
latest = {}
for gname in ('protocol', 'l1', 'l2', 'near_receipts'):
    idx, obs = build({}, {gname})
    idx_l, obs_l = build({'loose': True}, {gname})
    for e in sorted({e for e, _ in idx}):
        ms = sorted((m for ee, m in obs if ee == e))
        ms_l = sorted((m for ee, m in obs_l if ee == e))
        latest[e] = {'group': gname, 'n_valid_months': len(ms), 'first_valid': f'{ms[0] // 12}-{ms[0] % 12 + 1:02d}' if ms else None, 'latest_multiple': round(math.exp(obs[e, ms[-1]]), 1) if ms else None, 'latest_month': f'{ms[-1] // 12}-{ms[-1] % 12 + 1:02d}' if ms else None, 'median_multiple': round(float(np.exp(np.median([obs[e, m] for m in ms]))), 1) if ms else None, 'min_multiple': round(float(np.exp(min((obs[e, m] for m in ms)))), 1) if ms else None, 'max_multiple': round(float(np.exp(max((obs[e, m] for m in ms)))), 1) if ms else None, 'latest_multiple_loose': round(math.exp(obs_l[e, ms_l[-1]]), 1) if ms_l else None}
results['entity_summary'] = latest
near_hist = {}
for r in rows:
    if r['entity'] in ('NEAR Intents (receipts)', 'NEAR') and r['mcap'] and (r['rev365'] > 0):
        near_hist.setdefault(r['entity'], {})[r['date']] = {'mcap': round(r['mcap']), 'rev365': round(r['rev365']), 'multiple': round(r['mcap'] / r['rev365'], 1), 'passes_primary': passes(r, {})}
results['near_history'] = near_hist
json.dump(results, open(os.path.join(OUT, 'analysis_raw.json'), 'w'), indent=1)
print('done')
