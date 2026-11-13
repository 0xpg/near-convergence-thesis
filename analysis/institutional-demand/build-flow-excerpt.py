"""One attributed NRR chart excerpt; read JSON shipped to the public page, never execute website code."""
import argparse, hashlib, json, re
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal as D
from pathlib import Path

HERE=Path(__file__).resolve().parent
SOURCE='https://cryptoetf.today/en/etf/nrr-etf-price'

def payloads(html):
    chunks=[]
    for match in re.finditer(r'self\.__next_f\.push\((\[1,.*?\])\)</script>',html):
        chunks.append(json.loads(match.group(1))[1])
    objects=[]
    for line in ''.join(chunks).splitlines():
        try:objects.append(json.loads(line.split(':',1)[1]))
        except (ValueError,IndexError):pass
    return objects

def chart_payload(objects):
    found=[]
    def walk(value):
        if isinstance(value,dict):
            if value.get('ticker')=='NRR' and isinstance(value.get('flows'),list):found.append(value)
            for item in value.values():walk(item)
        elif isinstance(value,list):
            for item in value:walk(item)
    for value in objects:walk(value)
    assert len(found)==1,'Expected one explicit NRR chart payload'
    return found[0]

def build():
    html=(HERE/'cryptoetf-nrr.html').read_text(encoding='utf-8')
    chart=chart_payload(payloads(html));assert chart['hasFlow'] is True and 'US$ m' in chart['subtitle']
    rows=chart['flows'];dates=[r['date'] for r in rows]
    assert len(rows)==33 and len(set(dates))==len(dates) and dates==sorted(dates)
    assert dates[0]=='2026-09-29' and dates[-1]=='2026-11-12'
    # No NYSE closure in this observed range; Columbus Day and Veterans Day are open exchange sessions.
    start,end=map(date.fromisoformat,[dates[0],dates[-1]])
    expected=[(start+timedelta(days=i)).isoformat() for i in range((end-start).days+1) if (start+timedelta(days=i)).weekday()<5]
    assert dates==expected,'Missing session: do not fill with zero'
    fund_html=(HERE/'nrr-page.html').read_text(encoding='utf-8')
    fund=json.loads(re.search(r'<script id="__NEXT_DATA__"[^>]*>(.*?)</script>',fund_html,re.S).group(1))['props']['pageProps']['fundData']['data']
    nav={datetime.fromtimestamp(t/1000,timezone.utc).date().isoformat():D(str(v)) for t,v in fund['navAndMarketPrice']['chart']['nav']}
    assert list(nav)==dates[:-1],'Primary issuer NAV overlap differs'
    archived_js=(HERE/'wallstreet-data.js').read_text(encoding='utf-8')
    archive=json.loads(archived_js.split('window.INSTITUTIONS =',1)[1].strip().removesuffix(';'))
    anchors={r[0]:r[1] for r in archive['nrr']['days']};assert anchors['2026-09-28']==20000
    current_shares=20000;running=D(0);checks=[];out=[];anchor_checks=[]
    for row in rows:
        day=row['date'];value=D(str(row['flow']));assert value.is_finite()
        daily=value*1000000;running+=daily
        # Diagnostic only: inferred share changes are not substituted for observed raw share records.
        if day in nav:
            basket_change=int((daily/nav[day]/10000).to_integral_value())*10000
            arithmetic=daily-D(basket_change)*nav[day]
            tolerance=D(500)+abs(D(basket_change))*D('0.005')
            assert abs(arithmetic)<=tolerance,'Reported flow incompatible with NAV/basket rounding'
            current_shares+=basket_change
            checks.append({'date':day,'inferredNetBasketShares':basket_change,'primaryNav':float(nav[day]),'residualUsd':float(arithmetic),'roundingToleranceUsd':float(tolerance)})
        else:
            assert daily==0,'No primary NAV for nonzero final-session flow'
        if day in anchors:
            assert current_shares==anchors[day],f'Archive share anchor mismatch {day}'
            anchor_checks.append(day)
        out.append({'day':day,'reportedNetFlowUsd':float(daily),'cumulativeReportedNetFlowUsd':float(running)})
    assert current_shares==fund['fundDetails']['sharesOutstanding']==2930000,'Reconstructed share endpoints fail latest issuer anchor'
    direct_checks=[]
    archive_rows=archive['nrr']['days']
    for previous,current in zip(archive_rows,archive_rows[1:]):
        day=current[0];index=dates.index(day)
        adjacent=(index==0 and previous[0]=='2026-09-28') or (index>0 and dates[index-1]==previous[0])
        if not adjacent:continue
        delta=current[1]-previous[1];reported=D(str(out[index]['reportedNetFlowUsd']))
        recomputed=D(delta)*nav[day];tolerance=D(500)+abs(D(delta))*D('0.005')
        assert abs(reported-recomputed)<=tolerance
        lag_residual=None if previous[0] not in nav else reported-D(delta)*nav[previous[0]]
        direct_checks.append({'date':day,'observedArchiveShareChange':delta,'primaryNav':float(nav[day]),'reportedFlowUsd':float(reported),'recomputedFlowUsd':float(recomputed),'residualUsd':float(reported-recomputed),'roundingToleranceUsd':float(tolerance),'priorSessionNavResidualUsd':None if lag_residual is None else float(lag_residual)})
    assert len(direct_checks)==18
    gross_in=sum((D(str(r['reportedNetFlowUsd'])) for r in out if r['reportedNetFlowUsd']>0),D(0))
    gross_out=sum((D(str(r['reportedNetFlowUsd'])) for r in out if r['reportedNetFlowUsd']<0),D(0))
    assert gross_in+gross_out==running
    assert any(row['reportedNetFlowUsd']<0 for row in out) and any(row['reportedNetFlowUsd']==0 for row in out)
    peak=max(out,key=lambda row:row['cumulativeReportedNetFlowUsd'])
    first_three=sum(D(str(row['reportedNetFlowUsd'])) for row in out[:3])
    files=['cryptoetf-nrr.html','cryptoetf-terms.html','cryptoetf-methodology.html','cryptoetf-crypto-etf-flow-data.html','nrr-page.html','wallstreet-data.js',Path(__file__).name]
    result={'version':'nrr-reported-flow-excerpt-v1','source':SOURCE,'sourceClass':'Secondary-provider reported net creations/redemptions; not a primary-issuer daily share census.',
        'sourceUnits':'US dollar millions in public chart payload, converted to USD without adding precision.',
        'attribution':'Source: cryptoetf.today','rows':out,
        'summary':{'start':dates[0],'end':dates[-1],'sessions':len(rows),'cumulativeNetFlowUsd':float(running),'grossInflowsUsd':float(gross_in),'grossOutflowsUsd':float(gross_out),'positiveSessions':sum(r['reportedNetFlowUsd']>0 for r in out),'negativeSessions':sum(r['reportedNetFlowUsd']<0 for r in out),'reportedZeroSessions':sum(r['reportedNetFlowUsd']==0 for r in out),'peakCumulativeUsd':peak['cumulativeReportedNetFlowUsd'],'peakDate':peak['day'],'changeSincePeakUsd':float(running-D(str(peak['cumulativeReportedNetFlowUsd']))),'firstThreeSessionNetFlowUsd':float(first_three),'firstThreeSessionsShareOfLatestCumulativePct':float(100*first_three/running)},
        'validation':{'primaryNavDates':len(nav),'publicArchiveShareAnchors':len(anchor_checks),'shareAnchorDates':anchor_checks,'latestIssuerShares':current_shares,'inferredShareDiagnostic':checks,'directConsecutiveArchiveShareChecks':direct_checks,
            'interpretation':'Reported flow implies integer 10,000-share basket changes within published NAV and flow rounding; inferred changes reconcile every available archive share anchor and latest primary issuer shares. This consistency check does not independently verify each intermediate daily share record or transaction cash timing.'},
        'limitations':['Provider chart values have 0.001 USD million granularity; cumulative values sum the excerpt and can differ from an unrounded provider total.','T+1 reporting and revisions are controlled by the provider; no automatic refresh configured here.','Neither product investor identity nor unhedged institutional demand is identified.','The separate NEAR everywhere archive misses several sessions; its adjacent-record endpoint pricing is not used to backfill daily flows.'],
        'licenseReview':{'terms':'https://cryptoetf.today/en/terms','method':'https://cryptoetf.today/en/methodology','scope':'Terms section 6 permits small attributed chart/table excerpts. Dataset/feed redistribution is restricted. Use this bounded single-fund excerpt only for the attributed chart; do not publish the full page payload or offer a provider-data API/export.'},
        'inputHashes':[{'file':name,'sha256':hashlib.sha256((HERE/name).read_bytes()).hexdigest()} for name in files]}
    sql="-- One bounded, attributed public chart excerpt. Source: cryptoetf.today\n-- Secondary-provider reported net creations/redemptions; not primary audited cash flows or institutional ownership.\n-- Archived chart observations: 29 Sep–12 Nov 2026; rerunning SQL does not refresh provider data.\nWITH daily(day,reported_net_flow_usd) AS (\n VALUES\n"
    sql+=',\n'.join(f" (DATE '{r['day']}',DECIMAL '{int(r['reportedNetFlowUsd'])}.00')" for r in out)
    sql+="\n)\nSELECT day,reported_net_flow_usd,\n sum(reported_net_flow_usd) OVER (ORDER BY day ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS cumulative_reported_net_flow_usd,\n 'NRR · U.S. spot NEAR ETF' AS fund,\n 'Source: cryptoetf.today' AS attribution,\n 'https://cryptoetf.today/en/etf/nrr-etf-price' AS source_url,\n 'Reported net creations/redemptions, USD; 33 published sessions, 29 Sep–12 Nov 2026. Archived attributed chart excerpt, not live data, institutional investor identity, AUM or token-holdings change.' AS coverage,\n current_timestamp AS query_executed_utc\nFROM daily ORDER BY day\n"
    return result,sql

if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--check',action='store_true');args=parser.parse_args()
    result,sql=build()
    for filename,value in [('flow-history-candidate.json',json.dumps(result,indent=2,allow_nan=False)+'\n'),('03_nrr_cumulative_reported_flows.sql',sql)]:
        target=HERE/filename
        if args.check:assert target.read_text(encoding='utf-8')==value,'Stale '+filename
        else:target.write_text(value,encoding='utf-8',newline='\n')
    print(json.dumps(result['summary']))
