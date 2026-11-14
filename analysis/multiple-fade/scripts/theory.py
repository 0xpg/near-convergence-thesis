def gordon_r_minus_g(M, g, payout=1.0):
    return payout * (1 + g) / M

def gordon_M(r, g, payout=1.0):
    return payout * (1 + g) / (r - g)

def two_stage_M(r, g_high, years_high, g_stable, payout=1.0):
    v, cf = (0.0, 1.0)
    for k in range(1, years_high + 1):
        cf *= 1 + g_high
        v += payout * cf / (1 + r) ** k
    tv = payout * cf * (1 + g_stable) / (r - g_stable)
    return v + tv / (1 + r) ** years_high

def years_high_needed(M_target, r, g_high, g_stable, payout=1.0, max_years=60):
    for H in range(0, max_years + 1):
        if two_stage_M(r, g_high, H, g_stable, payout) >= M_target:
            return H
    return None
