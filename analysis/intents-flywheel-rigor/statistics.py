"""Descriptive financial diagnostics; no causal or future-return identification."""
import argparse
import hashlib
import json
import math
from datetime import date, timedelta
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[2]
HERE = Path(__file__).resolve().parent
FEE_FILE = ROOT / 'analysis/intents-flywheel/fee-productivity-result.json'
LONG_FILE = ROOT / 'data/glance-daily.json'
PANEL_FILE = HERE / 'fee-component-panel-result.json'
SEED, REPLICATES = 20261113, 10000


def ratio(data):
    assert len(data) and np.isfinite(data).all() and (data >= 0).all()
    denominator = data[:, 0].sum()
    assert denominator > 0
    return float(data[:, 1].sum() / denominator * 1e6)


def blocks(data, length, seed, circular=False):
    """Paired consecutive blocks; optional endpoint-wrap sensitivity, not a causal model."""
    n = len(data)
    assert 1 <= length <= n
    starts = np.random.default_rng(seed).integers(0, n if circular else n-length+1, (REPLICATES, math.ceil(n/length)))
    indices = (starts[:, :, None] + np.arange(length)).reshape(REPLICATES, -1)[:, :n]
    if circular:
        indices %= n
    samples = data[indices]
    return samples[:, :, 1].sum(axis=1) / samples[:, :, 0].sum(axis=1) * 1e6


def hac_fit(y, x, lag):
    n, k = x.shape
    assert len(y) == n and n > k and 0 <= lag < n and np.linalg.matrix_rank(x) == k
    inverse = np.linalg.inv(x.T @ x)
    beta = np.linalg.lstsq(x, y, rcond=None)[0]
    residual = y - x @ beta
    scores = x * residual[:, None]
    meat = scores.T @ scores
    for j in range(1, lag+1):
        cross = scores[j:].T @ scores[:-j]
        meat += (1-j/(lag+1)) * (cross + cross.T)
    covariance = inverse @ meat @ inverse * n/(n-k)
    assert np.linalg.eigvalsh(covariance).min() > -1e-8
    return beta, covariance, residual


def describe_model(name, y, x, fields):
    fits = []
    for lag in [0, 3, 7, 14]:
        beta, covariance, residual = hac_fit(y, x, lag)
        se = float(np.sqrt(max(0, covariance[1, 1])))
        fits.append({'hacLag': lag, 'elasticity': float(beta[1]), 'standardError': se,
                     'normalApprox95Interval': [float(beta[1]-1.96*se), float(beta[1]+1.96*se)],
                     'intervalContainsUnitElasticity': bool(beta[1]-1.96*se <= 1 <= beta[1]+1.96*se)})
    return {'model': name, 'observations': len(y), 'fields': fields,
            'coefficients': dict(zip(fields, map(float, beta))), 'hacSensitivity': fits,
            'residualLag1Correlation': float(np.corrcoef(residual[1:], residual[:-1])[0, 1]),
            'interpretation': 'Contemporaneous descriptive association; levels may be nonstationary. HAC does not solve omitted variables, endogenous volume, common shocks or measurement changes.'}


def scalar_slope_hac(y, x, lag):
    """Separate centered two-regressor slope formula; no matrix sandwich helper."""
    n = len(y)
    centered_x = [float(v)-sum(map(float,x))/n for v in x]
    centered_y = [float(v)-sum(map(float,y))/n for v in y]
    sxx = sum(v*v for v in centered_x)
    slope = sum(a*b for a,b in zip(centered_x,centered_y))/sxx
    errors = [b-slope*a for a,b in zip(centered_x,centered_y)]
    influence = [a*e/sxx for a,e in zip(centered_x,errors)]
    variance = sum(z*z for z in influence)
    for j in range(1,lag+1):
        variance += 2*(1-j/(lag+1))*sum(influence[t]*influence[t-j] for t in range(j,n))
    se = math.sqrt(max(0, variance*n/(n-2)))
    return {'elasticity':slope, 'standardError':se, 'normalApprox95Interval':[slope-1.96*se,slope+1.96*se]}


def summarize_window(rows):
    a = np.array([[float(r['reported_volume_usd']), float(r['reported_gross_fees_usd'])] for r in rows])
    return {'start': rows[0]['day'][:10], 'end': rows[-1]['day'][:10], 'days': len(rows),
            'reportedVolumeUsd': float(a[:, 0].sum()), 'reportedGrossFeesUsd': float(a[:, 1].sum()),
            'reportedFeesPerMillionUsd': ratio(a), 'missingFeeRows': sum(int(r['missing_fee_rows']) for r in rows)}


def validate_calendar(rows, key='day'):
    dates = [date.fromisoformat(row[key][:10]) for row in rows]
    assert len(set(dates)) == len(dates)
    assert all(b-a == timedelta(days=1) for a, b in zip(dates, dates[1:]))


def component_decomposition(fee_rows):
    panel=json.loads(PANEL_FILE.read_text(encoding='utf-8'))
    rows=[dict(zip(panel['rows'][0],row)) for row in panel['rows'][1:]]
    validate_calendar(rows)
    assert len(rows)==len(fee_rows)==90
    for row,fee in zip(rows,fee_rows):
        assert row['day'][:10]==fee['day'][:10], 'Financial source periods must align before decomposition'
        for key in ['volume_usd','public_volume_usd','confidential_volume_usd','fees_usd','protocol_fees_usd','public_affiliate_fees_usd','confidential_affiliate_fees_usd','other_affiliate_fees_usd']:
            assert math.isfinite(float(row[key])) and float(row[key])>=0
        assert int(row['invalid_volume_rows'])==int(row['invalid_fee_rows'])==0
        assert math.isclose(float(row['volume_usd']),float(fee['reported_volume_usd']),rel_tol=1e-10,abs_tol=1e-7)
        assert math.isclose(float(row['fees_usd']),float(fee['reported_gross_fees_usd']),rel_tol=1e-10,abs_tol=1e-7)
        assert math.isclose(sum(float(row[key]) for key in ['protocol_fees_usd','public_affiliate_fees_usd','confidential_affiliate_fees_usd','other_affiliate_fees_usd']),float(row['fees_usd']),rel_tol=1e-10,abs_tol=1e-7)
    def window(rs):
        total=lambda key:sum(float(row[key]) for row in rs)
        volume=total('volume_usd')
        classes=[]
        for label in ['public','confidential']:
            class_volume=total(label+'_volume_usd');class_fees=total(label+'_affiliate_fees_usd')
            assert class_volume>0
            classes.append({'reportingClass':label,'volumeUsd':class_volume,'affiliateFeesUsd':class_fees,
                            'volumeWeight':class_volume/volume,'affiliateFeesPerClassMillionUsd':class_fees/class_volume*1e6})
        residual_volume=volume-sum(row['volumeUsd'] for row in classes)
        assert residual_volume>=-max(1e-6,volume*1e-10)
        return {'start':rs[0]['day'][:10],'end':rs[-1]['day'][:10], 'reportedVolumeUsd':volume,
                'reportedGrossFeesUsd':total('fees_usd'),'reportedFeesPerMillionUsd':total('fees_usd')/volume*1e6,
                'protocolFeesUsd':total('protocol_fees_usd'),'unattributedProtocolFeesPerTotalMillionUsd':total('protocol_fees_usd')/volume*1e6,
                'otherAffiliateFeesPerTotalMillionUsd':total('other_affiliate_fees_usd')/volume*1e6,
                'unclassifiedVolumeUsd':max(0,residual_volume),'classes':classes,
                'missingFeeRows':sum(int(row['missing_fee_rows']) for row in rs),
                'unpricedVolumeRows':sum(int(row['unpriced_volume_rows']) for row in rs)}
    windows=[window(rows[i:i+30]) for i in [0,30,60]]
    prior,current=windows[-2:]
    changes=[]
    for a,b in zip(prior['classes'],current['classes']):
        within=(a['volumeWeight']+b['volumeWeight'])/2*(b['affiliateFeesPerClassMillionUsd']-a['affiliateFeesPerClassMillionUsd'])
        mix=(a['affiliateFeesPerClassMillionUsd']+b['affiliateFeesPerClassMillionUsd'])/2*(b['volumeWeight']-a['volumeWeight'])
        changes.append({'reportingClass':a['reportingClass'],'withinClassIntensityEffectPerMillionUsd':within,'volumeMixEffectPerMillionUsd':mix})
    protocol=current['unattributedProtocolFeesPerTotalMillionUsd']-prior['unattributedProtocolFeesPerTotalMillionUsd']
    other=current['otherAffiliateFeesPerTotalMillionUsd']-prior['otherAffiliateFeesPerTotalMillionUsd']
    reconstructed=protocol+other+sum(c['withinClassIntensityEffectPerMillionUsd']+c['volumeMixEffectPerMillionUsd'] for c in changes)
    observed=current['reportedFeesPerMillionUsd']-prior['reportedFeesPerMillionUsd']
    assert math.isclose(reconstructed,observed,rel_tol=1e-10,abs_tol=1e-7)
    return {'query':panel['query'],'windows':windows,
            'latestVsPrior':{'observedRateChangePerMillionUsd':observed,'unattributedProtocolIntensityChangePerMillionUsd':protocol,
                             'otherAffiliateIntensityChangePerMillionUsd':other,'classes':changes,
                             'reconstructedRateChangePerMillionUsd':reconstructed,'accountingResidual':observed-reconstructed},
            'formula':'R = protocolFees / totalVolume + otherAffiliateFees / totalVolume + sum_s(volumeWeight_s * affiliateFees_s / classVolume_s). Each product change uses mean(weight)*change(rate) + mean(rate)*change(weight); all rates scaled per $1M.',
            'interpretation':'Exact reporting-class accounting decomposition, not price power, causal attribution, independent customer cohorts or confidential trade-level reconstruction. Protocol fees remain privacy-unattributed. Two Dune queries use the same underlying datasets, so their reconciliation is not independent raw-source validation.'}


def self_check():
    a = np.array([[1., 2.], [100., 100.]])
    assert math.isclose(ratio(a), 102/101*1e6) and not math.isclose(ratio(a), np.mean(a[:, 1]/a[:, 0])*1e6)
    proportional = np.column_stack([np.arange(1, 31.), np.arange(1, 31.)*.002])
    for length in [1, 3, 7, 14]:
        for circular in [False, True]:
            assert np.allclose(blocks(proportional, length, SEED, circular), 2000.)
    x = np.column_stack([np.ones(40), np.arange(40)/40])
    y = x @ np.array([2., .9]) + np.sin(np.arange(40))*.2
    beta, cov0, u = hac_fit(y, x, 0)
    direct = np.linalg.inv(x.T@x) @ (x.T @ np.diag(u*u) @ x) @ np.linalg.inv(x.T@x) * 40/38
    assert np.allclose(cov0, direct)
    _, cov, _ = hac_fit(y, x, 7)
    scores=x*u[:, None]
    explicit=np.zeros((2, 2))
    for i in range(40):
        for j in range(40):
            if abs(i-j)<=7:
                explicit += (1-abs(i-j)/8)*np.outer(scores[i], scores[j])
    explicit=np.linalg.inv(x.T@x)@explicit@np.linalg.inv(x.T@x)*40/38
    assert np.allclose(cov, explicit)
    assert np.allclose(blocks(a, 1, SEED), blocks(a, 1, SEED))


def analyze():
    raw = json.loads(FEE_FILE.read_text(encoding='utf-8'))
    rows = [dict(zip(raw['rows'][0], r)) for r in raw['rows'][1:]]
    validate_calendar(rows)
    assert len(rows) == 90
    for row in rows:
        assert int(row['invalid_volume_rows']) == int(row['invalid_fee_rows']) == 0
        assert float(row['reported_volume_usd']) > 0 and float(row['reported_gross_fees_usd']) > 0
    a=np.array([[float(r['reported_volume_usd']), float(r['reported_gross_fees_usd'])] for r in rows])
    windows=[summarize_window(rows[i:i+30]) for i in [0, 30, 60]]
    previous, current = a[30:60], a[60:90]
    assert math.isclose(ratio(current), float(rows[-1]['trailing_30d_fees_per_million_usd']), rel_tol=1e-12)
    v0, f0 = previous.sum(axis=0); v1, f1 = current.sum(axis=0)
    r0, r1 = f0/v0, f1/v1
    volume_effect=float((v1-v0)*(r0+r1)/2)
    productivity_effect=float((r1-r0)*(v0+v1)/2)
    assert math.isclose(volume_effect+productivity_effect, f1-f0, rel_tol=1e-12)
    bootstrap=[]
    for length in [1, 3, 7, 14]:
      for circular in [False, True]:
        p=blocks(previous, length, SEED+length, circular)
        c=blocks(current, length, SEED+100+length, circular)
        delta=100*(c/p-1)
        bootstrap.append({'blockDays': length, 'endpointMode': 'circular sensitivity' if circular else 'noncircular moving blocks', 'replicates': REPLICATES,
                          'latestRatePercentile95Interval': list(map(float,np.quantile(c,[.025,.975]))),
                          'priorRatePercentile95Interval': list(map(float,np.quantile(p,[.025,.975]))),
                          'rateChangePercentile95IntervalPct': list(map(float,np.quantile(delta,[.025,.975]))),
                          'medianRateChangePct': float(np.median(delta)),
                          'bootstrapFractionRateChangePositive': float(np.mean(delta>0)),
                          'interpretation': 'Sensitivity interval conditional on local within-window stationarity, not a forecast, identification interval or causal p-value. Block1 is the iid diagnostic. Circular wrapping equalizes endpoint inclusion but joins last and first dates artificially; noncircular blocks weight central dates more. Short30day windows and long blocks make edge assumptions material.'})
    lv, lf = np.log(a[:,0]), np.log(a[:,1])
    specs=[('log levels',lf,np.column_stack([np.ones(90),lv]),['intercept','logVolume']),
           ('log levels plus linear time',lf,np.column_stack([np.ones(90),lv,np.arange(90)]),['intercept','logVolume','time']),
           ('first differences',np.diff(lf),np.column_stack([np.ones(89),np.diff(lv)]),['intercept','deltaLogVolume']),
           ('lagged controls plus time',lf[1:],np.column_stack([np.ones(89),lv[1:],lf[:-1],lv[:-1],np.arange(1,90)]),['intercept','logVolume','lagLogFees','lagLogVolume','time'])]
    models=[describe_model(*spec) for spec in specs]
    components=component_decomposition(rows)
    scalar_validation=[]
    for index in [0,2]:
        spec=specs[index]
        scalar=scalar_slope_hac(spec[1],spec[2][:,1],7)
        matrix=models[index]['hacSensitivity'][2]
        for key in ['elasticity','standardError']:
            assert math.isclose(scalar[key],matrix[key],rel_tol=1e-9,abs_tol=1e-11)
        assert np.allclose(scalar['normalApprox95Interval'],matrix['normalApprox95Interval'],rtol=1e-9,atol=1e-11)
        scalar_validation.append({'model':spec[0],'separateCenteredScalarFormula':scalar,'agreesWithMatrixSandwich':True})
    holdout=[]
    for spec in specs[:2]:
        name,y,x,fields=spec
        beta=np.linalg.lstsq(x[:60],y[:60],rcond=None)[0]
        residual=y[60:]-x[60:]@beta
        holdout.append({'model':name,'trainDays':60,'testDays':30,'logRootMeanSquaredError':float(np.sqrt(np.mean(residual**2))),
                        'logMeanAbsoluteError':float(np.mean(np.abs(residual))),
                        'trainCoefficients':dict(zip(fields,map(float,beta)))})
    baseline_log=np.log(a[60:,0]*(a[:60,1].sum()/a[:60,0].sum()))
    residual=lf[60:]-baseline_log
    holdout.append({'model':'fixed proportional rate learned on first60days','trainDays':60,'testDays':30,
                    'logRootMeanSquaredError':float(np.sqrt(np.mean(residual**2))), 'logMeanAbsoluteError':float(np.mean(np.abs(residual)))})
    long=json.loads(LONG_FILE.read_text(encoding='utf-8'))
    long_rows=long['rows'];validate_calendar(long_rows)
    assert len(long_rows)==364
    receipt_windows=[]
    for length in [30,90,364]:
        rs=long_rows[-length:];captured=sum(r['capturedUsd'] for r in rs);fees=sum(r['grossFeesUsd'] for r in rs);volume=sum(r['volumeUsd'] for r in rs)
        receipt_windows.append({'days':length,'start':rs[0]['day'],'end':rs[-1]['day'],'capturedUsd':captured,'grossFeesUsd':fees,
                                'capturedPerMillionUsd':captured/volume*1e6,'captureSharePct':captured/fees*100,
                                'zeroReceiptDays':sum(r['capturedUsd']==0 for r in rs),
                                'largestReceiptDaySharePct':max(r['capturedUsd'] for r in rs)/captured*100,
                                'interpretation':'Receipt-date cash observations, not trade accrual matching, executed purchases or proven demand. Wider aggregation reduces collection-timing sensitivity without solving attribution.'})
    long_lookup={r['day']:r for r in long_rows};shared=[r for r in rows if r['day'][:10] in long_lookup]
    reconciliation=[]
    for raw_key,ir_key in [('reported_volume_usd','volumeUsd'),('reported_gross_fees_usd','grossFeesUsd')]:
        raw_total=sum(float(r[raw_key]) for r in shared);ir_total=sum(long_lookup[r['day'][:10]][ir_key] for r in shared)
        reconciliation.append({'metric':raw_key,'sharedDays':len(shared),'rawDatasetTotal':raw_total,'irSnapshotTotal':ir_total,
                               'differencePctOfIr':100*(raw_total/ir_total-1),
                               'independentEvidence':False,'interpretation':'Related upstream reporting paths; exact volume reconciliation is not independent raw transaction validation. Fee differences require component/timing reconciliation before pooling.'})
    loo=[ratio(np.delete(current,i,axis=0)) for i in range(30)]
    current_window,previous_window=windows[-1],windows[-2]
    rate_interval=lambda circular:next(row['rateChangePercentile95IntervalPct'] for row in bootstrap if row['blockDays']==7 and row['endpointMode']==('circular sensitivity' if circular else 'noncircular moving blocks'))
    summary={'currentWindow':{'start':current_window['start'],'end':current_window['end']},
             'priorWindow':{'start':previous_window['start'],'end':previous_window['end']},
             'currentFeePerMillionUsd':current_window['reportedFeesPerMillionUsd'],
             'priorFeePerMillionUsd':previous_window['reportedFeesPerMillionUsd'],
             'productivityChangePct':float(100*(r1/r0-1)),
             'volumeChangePct':float(100*(v1/v0-1)), 'feesChangePct':float(100*(f1/f0-1)),
             'rateChangeSensitivity95Pct':{'blockDays':7,'noncircularMovingBlocks':rate_interval(False),
                                           'circularEndpointSensitivity':rate_interval(True),
                                           'interpretation':'Endpoint-sensitive resampling intervals, conditional on unverified within-window stationarity; not a forecast or a robust significance claim.'},
             'firstDifferenceElasticity':{'estimate':models[2]['hacSensitivity'][2]['elasticity'],
                                         'hacLag':7,'normalApprox95Interval':models[2]['hacSensitivity'][2]['normalApprox95Interval'],
                                         'intervalIncludesUnitElasticity':models[2]['hacSensitivity'][2]['intervalContainsUnitElasticity']},
             'reportingMix':{'priorConfidentialVolumeSharePct':components['windows'][-2]['classes'][1]['volumeWeight']*100,
                             'currentConfidentialVolumeSharePct':components['windows'][-1]['classes'][1]['volumeWeight']*100,
                             'netWithinClassIntensityEffectPerMillionUsd':sum(row['withinClassIntensityEffectPerMillionUsd'] for row in components['latestVsPrior']['classes']),
                             'netVolumeMixEffectPerMillionUsd':sum(row['volumeMixEffectPerMillionUsd'] for row in components['latestVsPrior']['classes']),
                             'unattributedProtocolIntensityEffectPerMillionUsd':components['latestVsPrior']['unattributedProtocolIntensityChangePerMillionUsd'],
                             'observedRateChangePerMillionUsd':components['latestVsPrior']['observedRateChangePerMillionUsd'],
                             'interpretation':'Exact reporting-class accounting, not matched customer cohorts, quoted execution prices or causal attribution.'},
             'superlinearFeeScalingEstablished':False,'persistentProductivityDeclineEstablished':False,
             'causalFlywheelEstablished':False,
             'conclusion':f"Reported fees per $1M changed from ${previous_window['reportedFeesPerMillionUsd']:,.0f} to ${current_window['reportedFeesPerMillionUsd']:,.0f} between matched30daywindows. This comparison is descriptive; sensitivity tests do not establish persistence, superlinear fee scaling or a causal solver flywheel."}
    return {'version':'near-intents-financial-rigor-v1','causalIdentification':False,'summary':summary,
            'inputs':[{'file':str(p.relative_to(ROOT)).replace('\\','/'),'sha256':hashlib.sha256(p.read_bytes()).hexdigest()} for p in [FEE_FILE,LONG_FILE,PANEL_FILE,Path(__file__)]],
            'runtime':{'numpy':np.__version__,'seed':SEED,'bootstrapReplicates':REPLICATES},
            'independentCalculationValidation':{'method':'Separate centered scalar OLS slope and HAC7 influence-score autocovariance, without matrix sandwich helper. Explicit full score-pair and HC0 checks also execute in self_check.',
                                                'results':scalar_validation,'statsmodelsInstalled':False,'newDependenciesInstalled':False},
            'windows':windows,
            'reportingClassDecomposition':components,
            'latestVsPrior':{'volumeChangePct':float(100*(v1/v0-1)),'feesChangePct':float(100*(f1/f0-1)),
                             'productivityChangePct':float(100*(r1/r0-1)), 'feeChangeUsd':float(f1-f0),
                             'symmetricVolumeEffectUsd':volume_effect,'symmetricProductivityEffectUsd':productivity_effect,
                             'interpretation':'Exact two-factor accounting decomposition F=V*(F/V), not causal attribution or quoted-fee change.'},
            'blockBootstrap':bootstrap,'regressions':models,
            'chronologicalHoldout':{'trainStart':rows[0]['day'][:10],'trainEnd':rows[59]['day'][:10],'testStart':rows[60]['day'][:10],'testEnd':rows[-1]['day'][:10],
                                    'models':holdout,'interpretation':'Exploratory chronological parameter split, not a preregistered untouched holdout. Conditional fitted fee association uses observed test-period volume, not an ex-ante forecast. Same provider history; no external venue controls.'},
            'dependenceDiagnostics':{'logFeesLag1Correlation':float(np.corrcoef(lf[1:],lf[:-1])[0,1]),'logVolumeLag1Correlation':float(np.corrcoef(lv[1:],lv[:-1])[0,1]),
                                     'unitRootOrCointegrationEstablished':False,'interpretation':'Autocorrelation motivates dependence-robust sensitivity; first differences and holdout challenge levels-only results. Formal stationarity and causal dynamics are not established.'},
            'latestRateLeaveOneDayOut':{'minimum':min(loo),'maximum':max(loo),'pointEstimate':ratio(current),'interpretation':'Deterministic single-day influence range, not a confidence interval.'},
            'receiptTimingDiagnostics':receipt_windows,'sourceReconciliation':reconciliation,
            'sources':[{'title':'Newey and West (1987), original covariance paper','url':'https://users.ssc.wisc.edu/~behansen/718/NeweyWest1987.pdf','role':'Method origin; scanned PDF lacked extractable text; exact Bartlett sandwich cross-checked against primary implementation below.'},
                       {'title':'Statsmodels primary implementation: Bartlett and S_hac_simple','url':'https://www.statsmodels.org/stable/_modules/statsmodels/stats/sandwich_covariance.html','reviewedSections':['weights_bartlett','S_hac_simple','cov_hac_simple'],'role':'Verified Bartlett weights 1-j/(L+1), lagged score cross-products and finite-sample correction n/(n-k). No package code downloaded or executed.'},
                       {'title':'Buehlmann and Kuensch, The Blockwise Bootstrap for General Parameters of a Stationary Time Series','url':'https://www.research-collection.ethz.ch/server/api/core/bitstreams/6ee4a421-2a0b-4d08-bcf8-d2ed766f6b27/content','role':'Author-hosted primary method context. Indexed full-text abstract reviewed; direct PDF retrieval returned403; no full-paper validation claimed.'},
                       {'title':'Zhang (2026), Incentives and Market Structure in Intent-Based Exchanges','url':'https://arxiv.org/html/2607.21955v1','reviewedSections':['4 Data','5 Empirical strategy','6.4 Mechanism','6.7 Robustness','8 Limitations'],'role':'Unvalidated preprint used only as methodological inspiration. Root primary-governance review found a treatment-date conflict, so its empirical causal findings are not accepted as independently verified evidence and are not transferred to NEAR. The statistical estimators here are independently specified and checked.'}],
            'limitations':['Reported gross fee numerator is incomplete and may differ in scope from receipt-based series; missing amounts are not recovered by statistical methods.',
                           'Ninety days cannot establish a durable equilibrium, and the latest two30daysegments show nonmonotonic productivity.',
                           'MBB intervals assume approximate within-segment stationarity and weak dependence; block-length sensitivity does not validate those assumptions.',
                           'No solver identities, order-size panels, execution-quality benchmarks, external controls or governance-dated NEAR experiment are available in these financial tables.',
                           'The cited2026 solver-reform preprint has an unresolved treatment-date conflict with primary governance evidence; its empirical causal conclusions are not validated or used as NEAR evidence.',
                           'No causal feedback coefficient, future revenue prediction, organic volume estimate or token valuation is identified.']}


if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--check',action='store_true');parser.add_argument('--self-check',action='store_true');args=parser.parse_args()
    self_check()
    if args.self_check:
        print('Passed paired block ratio invariance, reproducibility, HC0 equality and independent explicit-pair HAC covariance checks.')
    else:
        result=analyze();serialized=json.dumps(result,indent=2,allow_nan=False)+'\n';target=HERE/'statistics-result.json'
        if args.check:assert json.loads(target.read_text(encoding='utf-8'))==result,'Statistics artifact stale'
        else:target.write_text(serialized,encoding='utf-8',newline='\n')
        print(json.dumps({'latestVsPrior':result['latestVsPrior'],'blockBootstrap':result['blockBootstrap'],'holdout':result['chronologicalHoldout']['models']}))
