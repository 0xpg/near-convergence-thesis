import snapshot from '../data/institutional-demand.json';
import type {Insight} from './glance-coverage-insights.ts';
const {nrr,european}=snapshot;
const compact=(value:number,digits=1)=>new Intl.NumberFormat('en-US',{notation:'compact',maximumFractionDigits:digits}).format(value);
const percent=(value:number,digits=1)=>(value<0?'−':'+')+Math.abs(value).toFixed(digits)+'%';
const metadata={
  'investment-holdings':{title:'NEAR held by investment products',tab:'Holdings',description:'Latest issuer-reported NEAR holdings for two distinct products. Each bar retains its own issuer cutoff; these are not synchronized holdings, net flows or verified institutional ownership.'},
  'investment-units':{title:'European NEAR product units outstanding',tab:'Units',description:'Two observed European product unit counts: the administrator’s baseline and latest issuer snapshot. Source dates are not a complete daily flow series.'}
};
export const institutionalCharts=snapshot.charts.map(chart=>{
  const labels=metadata[chart.id];
  if(!labels)throw new Error('Unknown investment-product chart: '+chart.id);
  return {...chart,...labels};
});
const common={snapshot:'data/institutional-demand.json',research:'data/institutional-demand.json',calculation:{method:'Issuer snapshots keyed by ISIN; NEAR/NEAS listings count once. Unit-count change = latest units / baseline units − 1. European entitlement × units reconciles to claim-backed NEAR within source rounding; NRR entitlement is derived from reported holdings / shares. Source hashes, accounting checks and independent RPC sample are retained in the research download.',retrievedAt:snapshot.retrievedAt}};
export const institutionalInsights:Record<string,Insight>={
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
