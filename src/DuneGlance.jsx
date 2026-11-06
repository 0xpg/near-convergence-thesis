import React,{useState} from 'react';
import './dune-glance.css';
import evidence from '../data/glance-insights.json';

export const glanceCharts=[
  {id:'defi-capital',title:'DeFi capital',tab:'TVL',query:'9074769',visualization:'13123658',description:'USD value in tracked NEAR DeFi. Changes reflect prices and balances, not net deposits.'},
  {id:'stablecoins',title:'Stablecoins on NEAR',tab:'Stablecoins',query:'9074817',visualization:'13123708',description:'Tracked stablecoin circulation in USD. A balance measure that can overlap DeFi TVL.'},
  {id:'ir-fees',title:'Fees and captured revenue',tab:'Fees',query:'9077309',visualization:'13126541',description:'Daily fees and captured revenue in NEAR equivalents; receipts can occur on a different date from fee generation.'},
  {id:'ir-revenue',title:'Revenue components',tab:'Revenue',query:'9077309',visualization:'13129739',description:'Intents receipts and provider-classified native gas burn, in NEAR equivalents.'},
  {id:'ir-fee-sources',title:'Fee sources',tab:'Sources',query:'9077309',visualization:'13129736',description:'Intents service fees and native protocol fees, converted into NEAR equivalents.'},
  {id:'ir-cumulative',title:'Cumulative fees and revenue',tab:'Cumulative',query:'9077309',visualization:'13129719',description:'Cumulative fees and captured revenue across the source history.'},
  {id:'ir-wallets',title:'Revenue mix',tab:'Mix',query:'9080248',visualization:'13129747',description:'The source’s trailing-year wallet and gas-burn revenue classifications.'},
  {id:'ir-emissions',title:'Revenue and issuance',tab:'Issuance',query:'9077309',visualization:'13126520',description:'Daily captured revenue and emissions, both denominated in NEAR.'},
  {id:'ir-coverage',title:'Revenue coverage of issuance',tab:'Coverage',query:'9077309',visualization:'13129720',description:'Daily revenue / emissions × 100. The headline uses the ratio of 30-day totals.'},
  {id:'ir-transactions',title:'Base-chain transactions',tab:'Transactions',query:'9077345',visualization:'13129713',description:'Daily base-chain transaction counts from the public IR feed.'},
  {id:'ir-accounts',title:'Active and new accounts',tab:'Accounts',query:'9077345',visualization:'13129714',description:'Daily active and newly created accounts; these are different populations.'},
  {id:'ir-gas',title:'Base-chain gas fees',tab:'Gas',query:'9077345',visualization:'13129715',description:'Native gas fees in NEAR; excludes Intents cross-chain service fees.'},
  {id:'ir-price',title:'NEAR price',tab:'Price',query:'9077345',visualization:'13129716',description:'Historical provider price in USD.'},
  {id:'ir-supply',title:'Total and circulating supply',tab:'Supply',query:'9077345',visualization:'13129717',description:'Total and circulating supply in NEAR, using source definitions.'},
  {id:'ir-volume',title:'Intents trading volume',tab:'Volume',query:'9077358',visualization:'13126575',description:'Daily cross-chain trading notional in USD.'},
  {id:'ir-swaps',title:'Intents swaps',tab:'Swaps',query:'9077358',visualization:'13126584',description:'Daily reported Intents swap counts.'},
  {id:'ir-intents-fees',title:'Intents service fees',tab:'Fees',query:'9077358',visualization:'13126680',description:'Daily gross service fees in USD.'},
  {id:'defi-mix',title:'DeFi deployment by protocol',tab:'DeFi products',query:'9074882',visualization:'13123784',description:'Balances across tracked DeFi products. Excludes bridges and staking; product overlap may remain.'},
  {id:'stablecoin-mix',title:'Stablecoin mix',tab:'Stablecoins',query:'9074892',visualization:'13123797',description:'Tracked USD stablecoin balances. Native and bridged forms may be aggregated.'},
  {id:'ir-chains',title:'Intents volume by blockchain',tab:'Chains',query:'9080261',visualization:'13129769',description:'Provider blockchain labels over the last 30-day source window.'},
  {id:'ir-tokens',title:'Intents volume by token',tab:'Tokens',query:'9080259',visualization:'13129763',description:'Provider token-symbol labels over the last 30-day source window.'},
  {id:'ir-channels',title:'Fees by distribution channel',tab:'Channels',query:'9080255',visualization:'13129759',description:'All-time fees by referral label, in USD. A different window from the volume mixes.'}
];
export const glanceGroups=[
  {id:'capital',title:'Capital on NEAR',chartIds:['defi-capital','stablecoins']},
  {id:'revenue',title:'The revenue picture',chartIds:['ir-fees','ir-revenue','ir-fee-sources','ir-cumulative','ir-wallets']},
  {id:'issuance',title:'Revenue and issuance',chartIds:['ir-emissions','ir-coverage']},
  {id:'network',title:'On the base chain',chartIds:['ir-transactions','ir-accounts','ir-gas']},
  {id:'token',title:'The NEAR token',chartIds:['ir-price','ir-supply']},
  {id:'activity',title:'Intents activity',chartIds:['ir-volume','ir-swaps','ir-intents-fees']},
  {id:'composition',title:'Capital composition',chartIds:['defi-mix','stablecoin-mix']},
  {id:'reach',title:'Cross-chain reach',chartIds:['ir-chains','ir-tokens']},
  {id:'distribution',title:'Distribution',chartIds:['ir-channels']}
];

export default function DuneGlance(){
  const [selected,setSelected]=useState({});
  return <section className="thesis-data" aria-labelledby="thesis-data-title">
    <header><div><h2 id="thesis-data-title">NEAR at a glance</h2><p>Activity, capital and the economics connecting them.</p></div><a href="https://dune.com/0xpanatagama/near-economic" rel="noreferrer">Dune dashboard</a></header>
    <div className="thesis-data-grid">{glanceGroups.map(group=>{
      const chart=glanceCharts.find(chart=>chart.id===(selected[group.id]||group.chartIds[0]));
      const insight=evidence.insights[chart.id];
      const query=`https://dune.com/queries/${chart.query}/${chart.visualization}`;
      return <article className={'glance-tile glance-'+group.id} key={group.id} aria-labelledby={'glance-'+group.id+'-title'}>
        <div className="glance-tile-head"><h3 id={'glance-'+group.id+'-title'}>{group.title}</h3>
          {group.chartIds.length>1&&<div className="glance-switch" role="group" aria-label={group.title+' metrics'}>{group.chartIds.map(id=>{const option=glanceCharts.find(chart=>chart.id===id);return <button key={id} aria-pressed={chart.id===id} aria-controls={'glance-'+group.id+'-chart'} onClick={()=>setSelected(previous=>({...previous,[group.id]:id}))}>{option.tab}</button>;})}</div>}
          {insight?<div className="glance-insight" aria-live="polite"><strong>{insight.value}</strong><p className="glance-observation">{insight.headline}</p><details><summary>Evidence & calculation</summary><p>{insight.date}</p><p>{chart.description} {insight.limitation}</p><p>{insight.calculation.method}</p><a href={insight.source} rel="noreferrer">Source</a>{insight.snapshot&&<a href={insight.snapshot} download>Download source snapshot</a>}<a href="data/glance-insights.json" download>Download calculations</a></details></div>:<p>{chart.description}</p>}
        </div>
        <div className="glance-chart" id={'glance-'+group.id+'-chart'}>
          <iframe key={chart.id} title={chart.title+' — Dune visualization'} src={`https://dune.com/embeds/${chart.query}/${chart.visualization}`} loading="lazy" referrerPolicy="no-referrer"/>
        </div>
        <a className="glance-query" href={query} rel="noreferrer" aria-label={'View '+chart.title+' query on Dune'}>View query on Dune</a>
      </article>;
    })}</div>
    <p className="dune-freshness">Insight dates are in the evidence details. Dune charts show each query’s last successful run and may contain newer data. Changing a chart’s internal time window does not recalculate the snapshot insight.</p>
  </section>;
}
