import snapshot from '../data/institutional-demand.json';
import type {Insight} from './glance-coverage-insights.ts';
import {formatCompact as compact} from './format.ts';
const {nrr,european,flowSummary:flow}=snapshot;
const percent=(value:number,digits=1)=>(value<0?'−':'+')+Math.abs(value).toFixed(digits)+'%';
const metadata={
  'investment-holdings':{title:'NEAR held by investment products',tab:'Holdings',description:'Latest issuer-reported NEAR holdings for two distinct products. Each bar retains its own issuer cutoff; these are not synchronized holdings, net flows or verified institutional ownership.'},
  'investment-units':{title:'European NEAR product units outstanding',tab:'Units',description:'Two observed European product unit counts: the administrator’s baseline and latest issuer snapshot. Source dates are not a complete daily flow series.'},
  'investment-flows':{title:'NRR cumulative reported net flows',tab:'Net flows',description:'Cumulative secondary-provider reported net creations and redemptions for the U.S. NRR product. The area series sums reported daily USD flows; it is not AUM, NEAR holdings or an institutional-investor census.'}
};
export const institutionalCharts=snapshot.charts.map(chart=>{
  const labels=metadata[chart.id];
  if(!labels)throw new Error('Unknown investment-product chart: '+chart.id);
  return {...chart,...labels};
});
const common={snapshot:'data/institutional-demand.json',research:'data/institutional-demand.json',calculation:{method:'Issuer snapshots keyed by ISIN; NEAR/NEAS listings count once. Unit-count change = latest units / baseline units − 1. European entitlement × units reconciles to claim-backed NEAR within source rounding; NRR entitlement is derived from reported holdings / shares. Source hashes, accounting checks and independent RPC sample are retained in the research download.',retrievedAt:snapshot.retrievedAt}};
export const institutionalInsights:Record<string,Insight>={
  'investment-flows':{
    value:(flow.cumulativeNetFlowUsd<0?'−$':'$')+compact(Math.abs(flow.cumulativeNetFlowUsd)),
    headline:'Cumulative reported net flows into NRR, the U.S. NEAR product.',
    date:`Reported flows · ${flow.start} to ${flow.end} · ${flow.sessions} sessions`,
    takeaway:`The first three sessions account for ${flow.firstThreeSessionsShareOfLatestCumulativePct.toFixed(1)}% of the latest cumulative net inflow. The total is ${flow.changeSincePeakUsd<0?'$'+compact(Math.abs(flow.changeSincePeakUsd))+' below':'at'} its ${flow.peakDate} peak; launch demand has not translated into uninterrupted accumulation.`,
    source:flow.sourceUrl,attribution:{label:flow.sourceLabel,url:flow.sourceUrl},
    limitation:`This bounded ${flow.sessions}-session excerpt is reported by a secondary provider, not a primary-issuer daily share census. Checks against available share-count anchors and issuer NAV support consistency but do not independently establish every daily flow or transaction timing. Provider rounding, T+1 timing and later revisions apply. Reported zero sessions remain zero; missing sessions must not be manufactured. Product flows do not identify institutional beneficial owners or unhedged investor demand. This historical chart does not refresh automatically.`,
    calculation:{method:'Cumulative net flow = running sum of provider-reported daily net creations/redemptions in USD, beginning at zero before the first listed session. Original chart values have 0.001 USD million granularity. First-three-session share = their net-flow sum / latest cumulative net flow; peak gap = latest cumulative total − maximum cumulative total. No AUM or holdings-change proxy substitutes for reported flows.',retrievedAt:snapshot.retrievedAt}
  },
  'investment-holdings':{
    ...common,value:compact(nrr.nearHeld,2)+' NEAR',
    headline:`NRR, U.S. issuer-reported holdings. The European ETP separately reports ${compact(european.nearHeld,2)} NEAR.`,
    date:`Saved issuer snapshots · NRR ${nrr.holdingsIssuerDate}; Europe updated ${european.issuerDate} · separate cutoffs`,
    takeaway:`Exchange-traded access has broadened NEAR’s investment channel. The European vehicle’s units are ${Math.abs(european.change.sharesChangePct).toFixed(1)}% ${european.change.sharesChangePct<0?'below':'above'} its administrator baseline; this comparison alone does not establish persistent capital accumulation.`,
    source:'https://nrretf.com/',
    limitation:`Holdings are issuer-reported, not independently reconciled fund totals. NRR’s raw holdings date is ${nrr.holdingsIssuerDate}, while its page renders ${nrr.renderedHoldingsDate}; NAV has a different cutoff. Europe’s last-updated label is not a verified economic business date. Neither product AUM nor authorized-participant identities establish institutional ownership. The RPC sample verifies delegated positions for three addresses, but amounts did not reconcile to the issuer wallet snapshot. This saved research snapshot does not update automatically. No combined holdings total, verified USD flow or institutional ownership percentage is shown.`
  },
  'investment-units':{
    ...common,value:percent(european.change.sharesChangePct),
    headline:'Change in European product units outstanding from the administrator baseline.',
    date:`Saved observations · ${european.baselineDate} baseline; issuer snapshot updated ${european.issuerDate}`,
    takeaway:`The European vehicle has ${compact(Math.abs(european.change.sharesChange),2)} ${european.change.sharesChange<0?'fewer':'more'} units outstanding, while NEAR per unit changed ${percent(european.change.entitlementChangePct,4)}. The unit-count change cannot be explained by NEAR’s market price alone.`,
    source:'https://bitwiseinvestments.eu/resources/weekly_balance_report/bitwise-europe-gmbh_weekly_balance_report.pdf',
    limitation:`Administrator baseline ${european.baselineShares.toLocaleString('en-US')} units; latest issuer ${european.sharesOutstanding.toLocaleString('en-US')} units for ISIN ${european.isin}. This is a two-observation comparison, not daily flows. Corporate actions have not been exhaustively audited; the contraction is consistent with net redemptions but does not establish exact USD outflows, institutional selling or exchange execution. NEAR entitlement can change through staking and fees; the attribution is accounting, not a verified staking-reward ledger.`
  }
};
