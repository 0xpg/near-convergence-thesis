import coverage from '../data/glance-coverage.json';
import evidence from '../data/glance-insights.json';
import genesis from '../analysis/coverage-expansion/token/genesis-result.json';
import {formatCompact as compact} from './format.ts';

export type Insight={value:string,headline:string,date:string,limitation:string,source:string,snapshot?:string,research?:string,takeaway?:string,attribution?:{label:string,url:string},calculation:{method:string,[key:string]:unknown}};
function fact(metric:string){
  const row=coverage.facts.find(row=>row.metric===metric);
  if(!row||!Number.isFinite(row.value))throw new Error('Missing validated overview fact: '+metric);
  return row;
}
const pct=(metric:string)=>fact(metric).value.toFixed(1)+'%';
function insight(metric:string,headline:string,takeaway:string,unit='USD'):Insight{
  const row=fact(metric);
  return {value:(unit==='USD'?'$':'')+compact(row.value)+(unit==='USD'?'':' '+unit),headline,takeaway,date:row.metric.startsWith('Latest')?'As of '+row.end:row.start+' to '+row.end,limitation:row.interpretation,source:'https://dune.com/queries/9117970',snapshot:'data/glance-coverage.json',calculation:{method:'Saved re-runnable Dune finding; source-specific period and filters. '+coverage.version,metric,value:row.value}};
}
export const glanceInsights:Record<string,Insight>={...evidence.insights,
  'ir-volume':insight('30D reported priced volume','Reported Intents trading notional over 30 completed days.',`${pct('Confidential share of reported priced volume')} of reported volume is confidential, versus ${pct('Confidential share of reported gross fees')} of reported fees. Revenue mix matters as much as trading scale.`),
  'ir-intents-fees':insight('30D reported gross fees','Reported protocol and affiliate fees over the matched 30-day window.',`Reported fees per notional are ${coverage.derived.publicReportedGrossFeeBps.toFixed(1)} bps for the public cohort and ${coverage.derived.confidentialReportedGrossFeeBps.toFixed(1)} bps for confidential activity. This mix comparison is descriptive; it does not establish execution pricing or tokenholder yield.`),
  'intents-balances':insight('Latest reported priced balance','Reported priced assets held in Intents custody.',`${pct('Confidential share of reported priced balance')} of priced custody balances are confidential. Inventory held for settlement is a different economic measure from trading flow or deployable solver liquidity.`),
  'stablecoin-transfers':insight('Gross nominal transfer units','Gross USDC/USDT movement across 17 verified contracts over 30 days.',`${pct('Direct Intents custody share of nominal transfer units')} of nominal movement directly touches Intents custody. Settlement and custody therefore dominate this measured flow; it cannot be read as consumer payments.`,'units'),
  'stablecoin-mix':insight('Latest circulating stablecoin value','Provider-tracked circulation, excluding unreleased issuer inventory.',`USDC contributes ${compact(fact('Latest USDC circulating value').value/fact('Latest circulating stablecoin value').value*100)}% of tracked circulation. The circulating stock is distinct from issuer reserves and from gross transfer throughput.`),
  'ir-transactions':insight('Average daily successful execution hashes','Average daily transaction hashes with a successful receipt over 30 completed days.',`Each successful daily hash appearance carries ${fact('Action rows per successful daily hash appearance').value.toFixed(1)} accepted action rows on average. Execution complexity and transaction counts measure different parts of demand.`,'per day'),
  'ir-accounts':insight('Average daily originating accounts','Average daily originators in successful execution cohorts.',`The measured execution base averages ${compact(fact('Average daily originating accounts').value)} originating accounts daily. Relayers and applications can aggregate users, while bots can multiply accounts; this is an execution footprint rather than a population estimate.`,'per day'),
  'genesis-allocation':{value:compact(genesis.rows.reduce((sum,row)=>sum+Number(row[1]),0))+' NEAR',headline:'Historical announced genesis allocation.',date:'Genesis allocation · 2020',limitation:'Seven announced categories; not current ownership, circulating supply or a future issuance forecast.',source:'https://dune.com/queries/9117913',snapshot:'data/glance-coverage.json',calculation:{method:'Sum of the seven announced genesis allocations in query 9117913.'},takeaway:'The original allocation describes how the network began. Current dilution and ownership require separate issuance, vesting and holder records.'}
};
