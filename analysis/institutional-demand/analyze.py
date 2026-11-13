"""Offline issuer-record reconciliation. No investment-product flow is labeled institutional ownership."""
import argparse, csv, hashlib, io, json, math, re
from datetime import datetime, timezone
from decimal import Decimal as D
from html.parser import HTMLParser
from pathlib import Path
from pypdf import PdfReader

HERE=Path(__file__).resolve().parent
ROOT=HERE.parents[1]

class Text(HTMLParser):
    def __init__(self):
        super().__init__(); self.skip=0; self.parts=[]
    def handle_starttag(self,tag,attrs):
        if tag in ('script','style'): self.skip+=1
    def handle_endtag(self,tag):
        if tag in ('script','style'): self.skip-=1
    def handle_data(self,data):
        if not self.skip and data.strip(): self.parts.append(data.strip())

def text(html):
    parser=Text(); parser.feed(html); return ' '.join(parser.parts)

def number(value):
    result=D(str(value).replace(',','')); assert result.is_finite(); return result

def extract(pattern,source):
    match=re.search(pattern,source); assert match,pattern; return match.group(1)

def changes(shares0,entitlement0,shares1,entitlement1):
    # Exact symmetric accounting; daily creation prices and intraday execution are not identified.
    holdings0,holdings1=shares0*entitlement0,shares1*entitlement1
    units=(shares1-shares0)*(entitlement0+entitlement1)/2
    entitlement=(entitlement1-entitlement0)*(shares0+shares1)/2
    assert units+entitlement==holdings1-holdings0
    return dict(sharesChange=shares1-shares0,sharesChangePct=100*(shares1/shares0-1),
                entitlementChangePct=100*(entitlement1/entitlement0-1),
                entitlementBackedNearChange=holdings1-holdings0,
                symmetricUnitsEffectNear=units,symmetricEntitlementEffectNear=entitlement)

def default(value):
    if isinstance(value,D): return float(value)
    raise TypeError(type(value).__name__)

def analyze():
    sources=json.loads((HERE/'sources.json').read_text())
    for source in sources:
        assert hashlib.sha256((ROOT/source['file']).read_bytes()).hexdigest()==source['sha256'],source['file']
    html=(HERE/'nrr-page.html').read_text(encoding='utf-8')
    page=json.loads(extract(r'<script id="__NEXT_DATA__"[^>]*>(.*?)</script>',html))['props']['pageProps']
    fund=page['fundData']['data']; details=page['data']['nrr']['details']
    labels={item['label']:item['value'] for item in details}
    assert labels['Ticker']=='NRR' and labels['ISIN']=='US0919521015' and labels['CUSIP']=='091952101'
    fd,holding= fund['fundDetails'],fund['holdings']
    assert len(holding['basket'])==1 and holding['basket'][0]['companyName']=='NEAR'
    shares=number(fd['sharesOutstanding']); held=number(holding['basket'][0]['shares'])
    assert shares>0 and held>0 and shares%10000==0
    nav=fund['navAndMarketPrice']; visible=text(html)
    rendered_holdings_date=extract(r'Holdings Data as of (\d{2}/\d{2}/\d{4})',visible)
    rendered_fund_date=extract(r'Fund Details Data as of (\d{2}/\d{2}/\d{4})',visible)
    nrr=dict(product='Bitwise NEAR ETF',isin=labels['ISIN'],ticker='NRR',issuerDate=fd['asOfDate'],
             holdingsIssuerDate=holding['asOfDate'],renderedHoldingsDate=rendered_holdings_date,renderedFundDate=rendered_fund_date,
             sharesOutstanding=shares,nearHeld=held,derivedNearPerShare=held/shares,
             netAssetsUsd=number(fd['netAssets']),holdingsMarketValueUsd=number(holding['basket'][0]['marketValue']),
             impliedNetAssetValuePerShare=number(fd['netAssets'])/shares,
             displayedNav=number(nav['nav']),navIssuerDate=nav['asOfDate'],
             holdingsValueLessNetAssetsUsd=number(holding['basket'][0]['marketValue'])-number(fd['netAssets']),
             verifiedNetFlowUsd=None,verifiedInstitutionalOwnershipPct=None)
    assert fd['asOfDate']==holding['asOfDate']
    assert nav['asOfDate']!=fd['asOfDate'],'Reassess cross-date warning if source cutoffs align'
    assert datetime.strptime(rendered_holdings_date,'%m/%d/%Y').date().isoformat()!=holding['asOfDate']
    nrr['fieldQualityWarning']='Raw fundDetails.expenseRatio is zero while issuer-configured Sponsor Fee is 0.75%; zero is not accepted as the fee. Date-only issuer fields and rendered labels differ by one day; no timezone-cause claim is made.'
    nrr['sponsorFeeLabel']=labels['Sponsor Fee']
    assert labels['Sponsor Fee']=='0.75%' and fd['expenseRatio']==0
    chart=nav['chart']['nav']; dates=[datetime.fromtimestamp(row[0]/1000,timezone.utc).date().isoformat() for row in chart]
    assert len(dates)==len(set(dates)) and dates==sorted(dates)
    close=lambda a,b,tol: abs(a-b)<=tol
    assert close(number(chart[-1][1]),number(nav['nav']),D('0.00000001'))
    nrr['navObservations']=len(chart)
    nrr['datePolicy']='Keep raw issuer date and rendered label separately. NAV history does not supply historical shares; do not join different cutoffs or infer flows from price/NAV history.'

    eu_html=(HERE/'eu-near-page.html').read_text(encoding='utf-8');eu=text(eu_html)
    assert 'DE000A4A5GV2' in eu
    eu_shares=number(extract(r'Shares outstanding ([\d,]+)',eu))
    eu_near=number(extract(r'AUM in Cold-Storage NEAR ([\d,.]+)',eu))
    eu_entitlement=number(extract(r'Cryptocurrency Entitlement \(per unit\) NEAR ([\d,.]+)',eu))
    eu_updated=extract(r'NEAR Assets under Management Last updated: (\d{2}-\d{2}-\d{4} \d{2}:\d{2}:\d{2})',eu)
    eu_date=datetime.strptime(eu_updated,'%d-%m-%Y %H:%M:%S').date().isoformat()
    eu_aum=number(extract(r'AUM market value \(USD\) \$([\d,.]+)',eu))
    assert close(eu_shares*eu_entitlement,eu_near,D('0.03')),'Issuer entitlement/holdings identity'
    weekly=PdfReader(HERE/'eu-weekly-report.pdf')
    weekly_date=datetime.strptime(extract(r'Data as of (\d{2}\.\d{2}\.\d{4})',weekly.pages[0].extract_text()),'%d.%m.%Y').date().isoformat()
    row=extract(r'DE000A4A5GV2\s+XETR\s+([\d,.]+\s+NEAR\s+[\d,.]+\s+[\d,.]+\s+[\d,.]+)',weekly.pages[1].extract_text()).split()
    old_shares,old_entitlement,required,actual=map(number,[row[0],row[2],row[3],row[4]])
    assert close(old_shares*old_entitlement,required,D('0.05'))
    assert actual>=required and weekly_date<eu_date
    european=dict(product='Bitwise NEAR Staking ETP',isin='DE000A4A5GV2',ticker='NEAR / NEAS',
                  baselineDate=weekly_date,baselineShares=old_shares,baselineEntitlement=old_entitlement,
                  baselineRequiredCollateralNear=required,baselineActualCollateralNear=actual,
                  baselineCollateralCoveragePct=actual/required*100,
                  issuerDate=eu_date,sourceLastUpdatedLabel=eu_updated,businessDateIndependentlyVerified=False,sharesOutstanding=eu_shares,nearHeld=eu_near,nearEntitlement=eu_entitlement,netAssetsUsd=eu_aum,
                  change=changes(old_shares,old_entitlement,eu_shares,eu_entitlement),
                  verifiedNetFlowUsd=None,verifiedInstitutionalOwnershipPct=None,
                  interpretation='Observed unit-count contraction from the 5 November administrator report to the latest issuer snapshot. The page last-updated label is not independently verified as an economic business-date cutoff. Corporate actions not exhaustively audited; contraction is consistent with net redemptions, not an exact USD flow or exchange-selling inference. Decomposition uses entitlement-backed amounts, not excess collateral or realized staking alone. NEAR/NEAS are listings of one ISIN, not two funds.')

    wallets=fund['wallets']['walletBalances'];assert len({w['address'] for w in wallets})==len(wallets)
    assert all(re.fullmatch('[a-f0-9]{64}',w['address']) for w in wallets)
    wallet_total=sum((number(w['balance']) for w in wallets),D(0))
    sample=json.loads((HERE/'rpc-wallet-sample.json').read_text());pools=json.loads((HERE/'rpc-pool-sample.json').read_text())
    assert sample['blockHeight']==pools['blockHeight']
    records=[]
    for row,delegation in zip(sample['samples'],pools['samples'],strict=True):
        address=row['issuerRecord']['address'];assert address==delegation['address']
        liquid=row['rpc']['result'];assert liquid['block_height']==sample['blockHeight']
        total=(number(liquid['amount'])+number(liquid['locked']))/D(10)**24
        for check in delegation['checks']:
            assert check['pool'] in [pool['pool_id'] for pool in delegation['discovery']['pools']]
            result=check['response']['result'];assert result['block_height']==sample['blockHeight']
            total+=number(json.loads(bytes(result['result']).decode()))/D(10)**24
        claim=number(row['issuerRecord']['balance'])
        records.append(dict(address=address,issuerListedBalanceNear=claim,rpcLiquidAndDiscoveredPoolBalanceNear=total,differenceNear=total-claim,differencePct=(total/claim-1)*100))
    block=json.loads((HERE/'rpc-final-block.json').read_text())['result']['header']
    assert block['height']==sample['blockHeight']
    rpc=dict(blockHeight=sample['blockHeight'],blockTimeUtc=datetime.fromtimestamp(int(block['timestamp_nanosec'])/1e9,timezone.utc).isoformat(),
             issuerWalletListUpdatedAt=fund['wallets']['updatedAt'],issuerWalletCount=len(wallets),issuerWalletSumNear=wallet_total,
             differenceVersusFundHoldingsNear=wallet_total-held,samples=records,
             outcome='Pool claims and native accounts verified at one finalized block for three purposively selected issuer-listed addresses. Amounts do not match issuer wallet figures; wallet-list timestamp is not proof of valuation cutoff. This does not independently reconcile total fund holdings or prove beneficial ownership. FastNEAR discovers pools; canonical NEAR RPC reads balances. No holder balance is inferred from direct account state alone.')
    sec=PdfReader(HERE/'sec-13f-q3.pdf')
    matches=[]
    for index in range(146,152):
        content=sec.pages[index].extract_text()
        if re.search(r'091952\s+10\s+1',content):matches.append({'pdfPage':index+1,'matchedLine':' '.join(re.search(r'091952\s+10\s+1\s+BITWISE NEAR ETF\s+COM SHS BEN INT\s+ADDED',content).group(0).split())})
    assert len(matches)==1 and 'BITWISE NEAR ETF' in matches[0]['matchedLine']
    faq=text((HERE/'sec-13f-faq.html').read_text(encoding='utf-8'))
    assert 'November 16, 2026 (Monday)' in faq
    search=json.loads((HERE/'sec-cusip-search.json').read_text())
    assert search['response']['hits']['total']['relation']=='eq'
    # Pure accounting boundary checks: no creations with rewards; no false flow from price alone; unit splits.
    assert changes(D(100),D(5),D(100),D('5.01'))['symmetricUnitsEffectNear']==0
    assert changes(D(100),D(5),D(50),D(10))['entitlementBackedNearChange']==0
    assert changes(D(100),D(5),D(110),D(5))['entitlementBackedNearChange']==50
    result=dict(version='near-investment-product-demand-v1',scope='Institutional access and product capital, not an institutional-investor census.',
                nrr=nrr,european=european,onchainValidation=rpc,
                institutionalOwnership=dict(status='Unknown, not zero',securityEligible=matches,quarterEnd='2026-09-30',filingDeadline='2026-11-16',
                    indexedCusipSearch=dict(url=search['url'],retrievedAt=search['retrievedAt'],indexedMatches=search['response']['hits']['total']['value'],scope=search['scope']),
                    method='SEC Q3 official list confirms CUSIP eligibility; SEC deadline verified. Exact-CUSIP SEC full-text index search executed; no complete 13F information-table census executed. Do not infer manager ownership from product AUM or authorized-participant names. Even manager-reported holdings may represent client mandates or hedged inventory.'),
                flowMethod=dict(usd='Estimated net creations/redemptions = split-adjusted change in shares outstanding times same-business-date NAV. Actual transaction cash flow requires fund/AP records.',
                    near='Estimated NEAR-equivalent net creations/redemptions = split-adjusted change in shares times documented same-date basket entitlement; closing holdings/share is a proxy when transaction basket is absent.',
                    identity='A_t - A_(t-1) = (S_t-S_(t-1))*NAV_t + S_(t-1)*(NAV_t-NAV_(t-1)); exact accounting under consistent units, not exact transaction timing.',
                    guards=['Use product ISIN/CUSIP, never ticker alone; deduplicate exchange listings.','Preserve issuer business date, section date and retrieval time separately.','No daily flow without consecutive validated share observations and same-date NAV/entitlement. Missing dates remain unknown, not zero.','Separate changes in token entitlement, valuation, fund expenses and share creation/redemption.','Do not infer new spot buying from in-kind creations, nor institutional conviction from AP inventory.']),
                publishableNow=['Issuer-reported holdings and AUM with section-specific cutoff and date-render warning.','European unit-count comparison with independent administrator baseline and entitlement reconciliation.','Institutional reporting eligibility and deadline; ownership remains unknown.'],
                withheld=['Verified NRR daily or cumulative USD flows: historical issuer shares not supplied by captured snapshot.','Combined synchronized US/EU holdings total while NRR rendered/raw cutoff disagreement remains unresolved.','Institutional ownership percentage or named institutional allocation without underlying filings.','Custody-address totals as independently verified NRR holdings: sample and timing reconciliation failed.'],
                sources=sources,
                inputHashes=[dict(file=str(p.relative_to(ROOT)).replace('\\','/'),sha256=hashlib.sha256(p.read_bytes()).hexdigest()) for p in [Path(__file__),HERE/'rpc-wallet-sample.json',HERE/'rpc-pool-sample.json',HERE/'rpc-final-block.json',HERE/'sec-cusip-search.json']],
                checks=['Source byte hashes','Stable product identifiers','Primary-document extraction','Unique NAV dates','Entitlement times units equals claim-backed holdings','Independent administrator baseline identity and collateral coverage','Exact symmetric decomposition','Finalized RPC block equality and delegation inclusion','Pure accounting edge cases'])
    csv_out=io.StringIO(newline='');writer=csv.writer(csv_out,lineterminator='\n')
    writer.writerow(['product_isin','issuer_date','shares_outstanding','near_entitlement_per_share','near_amount','near_amount_basis','net_assets_usd','net_flow_usd','institutional_ownership_pct'])
    writer.writerow([labels['ISIN'],fd['asOfDate'],shares,held/shares,held,'issuer fund holdings',fd['netAssets'],'',''])
    writer.writerow(['DE000A4A5GV2',weekly_date,old_shares,old_entitlement,required,'administrator required collateral','','',''])
    writer.writerow(['DE000A4A5GV2',eu_date,eu_shares,eu_entitlement,eu_near,'issuer entitlement-backed holdings',eu_aum,'',''])
    return result,csv_out.getvalue()

if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--check',action='store_true');args=parser.parse_args()
    result,csv_output=analyze();encoded=json.dumps(result,indent=2,default=default,ensure_ascii=False,allow_nan=False)+'\n'
    for filename,content in [('findings.json',encoded),('observations.csv',csv_output)]:
        target=HERE/filename
        if args.check: assert target.read_text(encoding='utf-8')==content,'Stale '+filename
        else:target.write_text(content,encoding='utf-8',newline='\n')
    print(json.dumps({'nrr':{k:result['nrr'][k] for k in ['issuerDate','nearHeld','netAssetsUsd','navIssuerDate']},'europeanChange':result['european']['change'],'rpcSampleDifferencesPct':[r['differencePct'] for r in result['onchainValidation']['samples']],'institutionalOwnership':result['institutionalOwnership']['status']},default=default))
