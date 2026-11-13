"""Source-specific observability diagnostics, not a causal intervention estimate."""
import argparse, hashlib, json, math
from datetime import date, timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
HERE = Path(__file__).resolve().parent
PUBLIC = ROOT/'analysis/intents-flywheel/public-participation-result.json'
PANEL = HERE/'fee-component-panel-result.json'

def rows(path):
    raw=json.loads(path.read_text(encoding='utf-8')); head=raw['rows'][0]
    assert len(head)==len(set(head))
    out=[dict(zip(head,r)) for r in raw['rows'][1:]]
    assert all(len(r)==len(head) for r in raw['rows'][1:])
    return sorted(out,key=lambda r:r['day']),raw['query']

def value(row,key):
    assert row[key] not in ('',None,'null'), f'Missing {key}'
    x=float(row[key]); assert math.isfinite(x) and x>=0
    return x

def mean(values):
    values=list(values); assert values
    return math.fsum(values)/len(values)

def variance(values):
    assert len(values)>1
    center=mean(values)
    return math.fsum((x-center)**2 for x in values)/(len(values)-1)

def scan(values,dates,cut):
    assert len(values)==len(dates) and min(values)>0
    logs=list(map(math.log,values)); candidates=[]
    for split in range(7,len(logs)-6):
        a,b=logs[:split],logs[split:]
        variance_of_shift=variance(a)/len(a)+variance(b)/len(b)
        assert variance_of_shift>0
        candidates.append({'date':dates[split], 'absoluteStandardizedLogMeanShift':abs(mean(b)-mean(a))/math.sqrt(variance_of_shift)})
    candidates.sort(key=lambda r:(-r['absoluteStandardizedLogMeanShift'],r['date']))
    selected=next(r for r in candidates if r['date']==cut)
    return {'minimumDaysPerSide':7,'candidateDates':len(candidates),'largestDescriptiveShift':candidates[0],'announcedCutoverDate':cut,'announcedDateRank':candidates.index(selected)+1,'announcedDateStatistic':selected['absoluteStandardizedLogMeanShift'],'interpretation':'Relative ranking of descriptive mean shifts only. Serial dependence, shared trends, endogenous migration and 30-day window selection preclude treating this rank as a randomization p-value or causal effect.'}

def main():
    public,public_query=rows(PUBLIC); financial,financial_query=rows(PANEL)
    dates=[r['day'][:10] for r in public]
    assert len(public)==30 and len(dates)==len(set(dates))
    assert dates==[(date.fromisoformat(dates[0])+timedelta(days=i)).isoformat() for i in range(30)]
    indexed={r['day'][:10]:r for r in financial}; assert len(indexed)==len(financial)
    assert all(d in indexed for d in dates)
    assert all(value(r,'window_observed_contract_log_days')==30 and value(r,'successful_contract_log_rows')>0 for r in public)
    cut='2026-10-27'; split=dates.index(cut)
    assert split==13
    accounts=[value(r,'active_signing_accounts') for r in public]
    events=[value(r,'public_account_intents') for r in public]
    volume=[value(indexed[d],'volume_usd') for d in dates]
    conf=[value(indexed[d],'confidential_volume_usd') for d in dates]
    pubvol=[value(indexed[d],'public_volume_usd') for d in dates]
    assert all(abs(p+c-v)<max(1e-5,v*1e-9) for p,c,v in zip(pubvol,conf,volume))
    def summary(indices):
        idx=list(indices); total=sum(volume[i] for i in idx)
        return {'start':dates[idx[0]],'end':dates[idx[-1]],'days':len(idx),'averageDailySigningAccounts':mean(accounts[i] for i in idx),'averageDailyPublicAccountEvents':mean(events[i] for i in idx),'averageDailyReportedPricedVolumeUsd':total/len(idx),'confidentialShareOfReportedPricedVolumePct':100*sum(conf[i] for i in idx)/total}
    before,after=summary(range(split)),summary(range(split,30))
    first,last=summary(range(7)),summary(range(23,30))
    def changes(a,b):
        return {key+'ChangePct':100*(b[key]/a[key]-1) for key in ['averageDailySigningAccounts','averageDailyPublicAccountEvents','averageDailyReportedPricedVolumeUsd']}
    # The payoff terms common to every solver cannot change a conditional winning identity.
    for costs in ([2,5,9],[20,3,4],[7,7,10]):
        for common in (-100,0,1000):
            assert max(range(len(costs)),key=lambda i:common-costs[i])==min(range(len(costs)),key=lambda i:costs[i])
    result={'version':'near-intents-identification-audit-v1','reviewedOn':'2026-11-13','causalIdentification':False,'sourceWindow':{'start':dates[0],'end':dates[-1],'observedSuccessfulContractLogDays':30},'observability':{'documentedChange':{'date':cut,'source':'https://docs.agentsonintents.com/changelog/overview','scope':'Official 1Click confidential-settlement announcement; not proof that every integration migrated at one instant.'},'preAnnouncement':before,'postAnnouncement':after,'descriptivePrePostChange':changes(before,after),'equalLengthEndpointCheck':{'first7Days':first,'last7Days':last,'change':changes(first,last)},'dateScan':{'signingAccounts':scan(accounts,dates,cut),'reportedAllSourceVolume':scan(volume,dates,cut)},'conclusion':'Public signing-account counts and reported all-source notional cover different populations. Their divergence and documented confidential settlement invalidate interpreting the public count decline as total network demand loss. Neither the announcement nor this short-window date scan identifies a causal migration effect.'},'paperAudit':[{'arxiv':'2403.02525v2','url':'https://arxiv.org/html/2403.02525v2','authors':['Tarun Chitra','Kshitij Kulkarni','Mallesh Pai','Theo Diamandis'],'type':'Auction-theoretic and optimization models','verifiedSections':['2.2 Costly entry','2.3 Costly effort','3 Optimization approach'],'usableImplication':'Entry costs, costly effort and congestion make more solver addresses an insufficient welfare statistic; optimal entry may be limited. This is a conditional model prediction, not a NEAR empirical estimate.','neededValidation':'Actual independent solver entities, submitted and winning quotes, order size, route, fills, latency, and user execution benchmarks.'},{'arxiv':'2607.21955v1','url':'https://arxiv.org/html/2607.21955v1','type':'CoW-specific empirical preprint','verifiedSections':['2.1 payoff model','4 data','5 empirical strategy','6 results','8 limitations','Data and Code Availability'],'replicationPackage':{'url':'https://github.com/ryonzhang/solver-reward-market-structure/tree/v1.0-preprint','status':'Public repository and tag exist; README names committed data, code and result targets. Execution and numerical replication were not performed.'},'governanceDateDiscrepancy':{'paperBundledTreatmentDate':'2025-12-08','independentForumPosts':[{'url':'https://forum.cow.fi/t/cip-74-align-solver-rewards-with-protocol-revenue-and-introduce-a-volume-based-fee/3234?page=2','postAuthor':'koeppelmann','postDate':'2025-11-27','evidence':'Reports that the 2bps volume fee activated the prior day.'},{'url':'https://forum.cow.fi/t/cip-74-align-solver-rewards-with-protocol-revenue-and-introduce-a-volume-based-fee/3234?page=2','postAuthor':'middleway.eth','postDate':'2025-11-28','evidence':'Reports that the 2bps fee went live on Wednesday, consistent with 26 November.'}],'finding':'Fee rollout and reward-cap implementation must be dated separately before accepting a bundled 8 December treatment. Reward-cap activation date not independently established here.'},'modelCheck':'Under the written common reward/fee conditional payoff, argmax(common term minus cost) equals argmin(cost). A change in winner concentration requires additional endogenous entry, cost, inventory, bid or order-selection mechanisms; the common payoff shift alone does not prove Proposition2. Finite-grid invariant self-check executes.','usableMethods':'Count-versus-value measures, leave-one-entity-out, order-size segmentation, time/placebo and cross-venue sensitivity. These require correctly observed solver/order identities and a validated event date.','nonTransferable':'The CoW treatment coefficients, venue counterfactual, size-bucket estimates and execution-quality bounds do not estimate a NEAR flywheel.'}],'expertOverlookedQuestions':['Does one signed payload emit multiple valid token_diff statements? Establish event grain before counting orders.','Is an observed account an executor, signer, customer, relayer or independent solver entity?','Has public observability changed independently of underlying demand?','Do volume-weighted and count-weighted concentration agree, and survive exclusion of the largest verified entity?','Are protocol fees, affiliate fees, solver surplus, customer all-in costs and holder receipts separated?','What order-level reference execution, chain fees and latency establish whether customers actually benefit?'],'claimPermissions':{'verified':['Source-specific arithmetic and observed event-account statistics on completed dates.','Exact accounting decompositions with explicit component labels.','Announced confidentiality architecture and observed public-data composition changes.'],'inferenceOnly':['Restricted-entry and inventory advantages as economic hypotheses.','Possible role of reporting/settlement migration in public-count decline.'],'notIdentified':['Causal network flywheel or solver-competition effect.','Complete solver count or beneficial ownership.','Organic USD volume or proven wash-trading rate.','Execution-price welfare or market power from aggregate fee intensity.']},'inputs':[{'file':str(p.relative_to(ROOT)).replace('\\','/'),'sha256':hashlib.sha256(p.read_bytes()).hexdigest()} for p in [PUBLIC,PANEL,Path(__file__)]]}
    target=HERE/'identification.json'; encoded=json.dumps(result,indent=2,ensure_ascii=False)+'\n'
    parser=argparse.ArgumentParser(); parser.add_argument('--check',action='store_true')
    if parser.parse_args().check:assert target.read_text(encoding='utf-8')==encoded,'Stale identification artifact'
    else:target.write_text(encoded,encoding='utf-8',newline='\n')
    print(json.dumps({'window':result['sourceWindow'],'prePost':result['observability']['descriptivePrePostChange'],'endpoint7d':result['observability']['equalLengthEndpointCheck']['change'],'accountDateScan':result['observability']['dateScan']['signingAccounts'],'allSourceVolumeDateScan':result['observability']['dateScan']['reportedAllSourceVolume']}))

if __name__=='__main__':main()
