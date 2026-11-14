import sys, os, json, math, datetime as dt
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from theory import gordon_r_minus_g, gordon_M, two_stage_M, years_high_needed
OUT, RES = (sys.argv[1], sys.argv[2])
A = json.load(open(os.path.join(OUT, 'analysis_raw.json')))
P = A['groups']['protocol']['primary']
L1 = A['groups']['l1']['primary']
M0 = 197.0
TODAY, EXIT = (dt.date(2026, 11, 14), dt.date(2031, 12, 31))
TAU = (EXIT - TODAY).days / 365.25

def fade(L, phi, tau=TAU, m0=M0):
    return math.exp(math.log(L) + (math.log(m0) - math.log(L)) * phi ** tau)
phi_primary = P['ar1_primary']['b_per_year']
phi_primary_hi = P['ar1_primary']['b_ci95'][1]
phi_rel = P['ar1_relative_to_date_mean']['b_per_year']
phi_rel_hi = P['ar1_relative_to_date_mean']['b_ci95'][1]
phi_dec = P['ar1_december_only']['b_per_year']
L_lr = P['ar1_primary']['long_run_multiple']
L_med = P['cross_section_2026_10']['median']
L_q3 = P['cross_section_2026_10']['q3']
cases = {'Bear': {'L': L_lr, 'phi': phi_dec, 'basis': 'L = protocol panel long-run mean exp(a/(1-b)); phi = December-only (non-overlapping) protocol AR(1), fastest point estimate'}, 'Base': {'L': L_med, 'phi': phi_primary, 'basis': 'L = protocol cross-section median 2026-10; phi = pre-registered primary protocol AR(1)'}, 'Bull': {'L': L_q3, 'phi': phi_rel, 'basis': 'L = protocol cross-section upper quartile 2026-10; phi = protocol AR(1) relative to date mean (slower, cycle-neutral fade)'}, 'Maximum': {'L': L_q3, 'phi': phi_rel_hi, 'basis': 'L = protocol upper quartile; phi = upper 95% bound of cycle-neutral protocol AR(1) (slowest fade the protocol data do not reject)'}}
rec = {}
for k, c in cases.items():
    M_T = fade(c['L'], c['phi'])
    hl = math.log(0.5) / math.log(c['phi'])
    rec[k] = {'long_run_L': round(c['L'], 1), 'phi_per_year': round(c['phi'], 4), 'half_life_years': round(hl, 2), 'exit_multiple_2031_12_31': round(M_T, 1), 'path': {str(y): round(fade(c['L'], c['phi'], tau=(dt.date(y, 12, 31) - TODAY).days / 365.25), 1) for y in range(2026, 2032)}, 'implied_r_minus_g_gordon_g3pct': round(gordon_r_minus_g(M_T, 0.03), 4), 'basis': c['basis']}
L1_lr = L1['ar1_primary']['long_run_multiple']
alt_l1 = {'hold_today_phi1': {'exit_multiple_2031_12_31': M0, 'implied_r_minus_g_gordon_g3pct': round(gordon_r_minus_g(M0, 0.03), 4)}, 'fade_to_L1_long_run': {'L': L1_lr, 'phi': L1['ar1_primary']['b_per_year'], 'exit_multiple_2031_12_31': round(fade(L1_lr, L1['ar1_primary']['b_per_year']), 1)}, 'geometric_blend_50_50_L': {'L': round(math.sqrt(L_med * L1_lr), 1), 'phi': phi_primary, 'exit_multiple_2031_12_31': round(fade(math.sqrt(L_med * L1_lr), phi_primary), 1)}, 'note': 'Not recommended for a receipts-only model: L1 multiples are on burned-fee revenue and embed a non-receipt premium; shown for completeness.'}
current = {str(m): {'implied_r_minus_g_gordon_g3pct': round(gordon_r_minus_g(m, 0.03), 4), 'implied_r_if_g_3pct': round(0.03 + gordon_r_minus_g(m, 0.03), 4)} for m in (100, 197, 200, 250)}
for k in rec:
    m = rec[k]['exit_multiple_2031_12_31']
    rec[k]['implied_r_if_g_3pct'] = round(0.03 + gordon_r_minus_g(m, 0.03), 4)
grid = {}
for L in (5, 10, 15, 24, 50, 100, 525):
    for phi in (0.5, 0.6, 0.672, 0.734, 0.812, 0.885, 0.926, 1.0):
        grid[f'L={L},phi={phi}'] = round(fade(L, phi), 1) if phi < 1 else M0
gordon = {f'r={r},g={g}': round(gordon_M(r, g), 1) for r in (0.08, 0.1, 0.12, 0.15, 0.2) for g in (0.02, 0.03, 0.04)}
two_stage = {}
for r in (0.12, 0.15, 0.2):
    for gh in (0.2, 0.3, 0.5):
        for M in (15, 25, 50, 100, 200, 250):
            two_stage[f'M={M},r={r},g_high={gh},g_stable=0.03'] = years_high_needed(M, r, gh, 0.03)
results = {'generated_utc': dt.datetime.utcnow().strftime('%Y-%m-%dT%H:%M:%SZ'), 'inputs': {'M0_today': M0, 'M0_source': 'repo data/lab-rigor.json nearSpecific: mcap 4,358,227,905 / capturedAnnualUsd 22,113,744', 'tau_years_to_exit': round(TAU, 3), 'fade_model': 'ln M(t) = ln L + (ln M0 - ln L) * phi^t'}, 'recommendation': rec, 'current_preset_implications': current, 'alternative_L1_comparable': alt_l1, 'sensitivity_grid_exit_multiple': grid, 'gordon_multiple_table_payout1': gordon, 'two_stage_years_of_high_growth_needed': two_stage, 'empirical': A, 'theory_sources': {'Damodaran_InvestmentValuation_ch12': {'url': 'https://pages.stern.nyu.edu/~adamodar/pdfiles/valn2ed/ch12.pdf', 'file': 'raw/papers/damodaran_ch12.pdf', 'p3': 'using multiples to estimate terminal value, when those multiples are estimated from comparable firms, results in a dangerous mix of relative and discounted cash flow valuation ... the only consistent way of estimating terminal value in a discounted cash flow model is to use either a liquidation value or a stable growth model.', 'p4': 'the constant growth rate cannot be greater than the overall growth rate of the economy', 'p6': 'a simple rule of thumb on the stable growth rate is that it should not exceed the riskless rate used in the valuation.', 'p24': 'terminal value is manipulated often and easily, but it is because analysts either use multiples or because they violate one or both of two basic propositions in stable growth models'}, 'Fama_French_2000_JBus_73_2_161-175': {'url': 'https://ideas.repec.org/a/ucp/jnlbus/v73y2000i2p161-75.html', 'file': 'raw/papers/ff2000_ideas.html', 'abstract': 'In a simple partial adjustment model, the estimated rate of mean reversion is about 38% per year ... mean reversion is faster when profitability is below its mean and when it is further from its mean in either direction.', 'derived_half_life_years': round(math.log(0.5) / math.log(1 - 0.38), 2), 'verified_scope': 'abstract only (full text paywalled)'}, 'Chan_Karceski_Lakonishok_2003_JF_58_2_643-684': {'url': 'https://www.lsvasset.com/pdf/research-papers/Level+Persistence_of_Growth_Rates_FINAL.pdf', 'file': 'raw/papers/ckl2003.pdf', 'p643_abstract': 'There is no persistence in long-term earnings growth beyond chance', 'p649': "stock with a current price-earnings multiple of 100, which declines to 20 in 10 years' time with an expected return of 10 percent per year. Earnings must grow at 29.2 percent per year over 10 years ... corresponds to about the 95th percentile ... at 14.7 percent (the 75th percentile) ... the current ratio of 100 would be justified if the time it takes for the multiple to fall to 20 is stretched out to 38 years.", 'p649b': 'median growth rate over 10 years for income before extraordinary items is about 10 percent for all firms ... real ... roughly 3.5 percent per year', 'p655': 'An average of 57 firms out of 1,884 survivors (3 percent) beat the median for 5 years in a row, while 59 (3.1 percent) are expected to do so.'}, 'Mauboussin_Callahan_2016_MeasuringTheMoat_CreditSuisse': {'url': 'https://www.safalniveshak.com/wp-content/uploads/2017/01/Measuring-the-Moat-Mauboussin-2016.pdf', 'file': 'raw/papers/mauboussin_moat_2016.pdf', 'p4': 'how long a company can earn returns in excess of the cost of capital. This concept is also known as fade rate, competitive advantage period (CAP), value growth duration, and T.', 'p5': 'the time that an average company can sustain excess returns is shrinking', 'p6': 'the absolute level of returns and the level of investment are positively related to the rate of fade.'}}, 'raw_sha256': json.load(open(os.path.join(OUT, 'raw_sha256.json'))), 'preregistration': json.load(open(os.path.join(OUT, 'preregistration.json')))}
def finite(value):
    if isinstance(value, float) and (value != value or value in (float('inf'), float('-inf'))):
        return str(value)
    if isinstance(value, dict):
        return {k: finite(v) for k, v in value.items()}
    if isinstance(value, list):
        return [finite(v) for v in value]
    return value
json.dump(finite(results), open(RES, 'w'), indent=1, allow_nan=False)
for k, v in rec.items():
    print(k, v['exit_multiple_2031_12_31'], v['half_life_years'], v['long_run_L'], v['implied_r_minus_g_gordon_g3pct'], v['path'])
print(current)
print({k: v for k, v in two_stage.items() if 'r=0.15' in k})
print(gordon)
