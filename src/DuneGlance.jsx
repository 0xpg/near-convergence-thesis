import React,{useState} from 'react';
import './dune-glance.css';

export const glanceCharts=[
  {id:'defi-capital',title:'DeFi capital',tab:'TVL',query:'9012791',visualization:'13057058',description:'USD value in tracked NEAR DeFi. Changes reflect prices and balances, not net deposits.'},
  {id:'stablecoins',title:'Stablecoins on NEAR',tab:'Stablecoins',query:'9012810',visualization:'13057075',description:'Tracked stablecoin circulation in USD. A balance measure that can overlap DeFi TVL.'},
  {id:'intents-volume',title:'Intents trading volume',tab:'Volume',query:'9019417',visualization:'13064021',description:'Daily cross-chain trading notional. Service activity, not NEAR token demand.'},
  {id:'intents-fees',title:'Intents gross fees',tab:'Gross fees',query:'9019419',visualization:'13064023',description:'Protocol and distribution fees in USD. Gross fees are not tokenholder revenue.'},
  {id:'defi-mix',title:'DeFi deployment by protocol',tab:'DeFi products',query:'9013583',visualization:'13057945',description:'Balances across tracked DeFi products. Excludes bridges and staking; product overlap may remain.'},
  {id:'stablecoin-mix',title:'Stablecoin mix',tab:'Stablecoins',query:'9013584',visualization:'13057946',description:'Tracked USD stablecoin balances. Native and bridged forms may be aggregated.'},
  {id:'chain-mix',title:'Intents volume by blockchain',tab:'Chains',query:'9019422',visualization:'13064026',description:'Reported source-chain labels over 30 completed UTC days. This is not NEAR L1 settlement volume.'},
  {id:'token-mix',title:'Intents volume by token',tab:'Tokens',query:'9019421',visualization:'13064025',description:'Reported token-symbol mix over 30 completed UTC days, using source-provided labels.'},
  {id:'distribution',title:'Fees by distribution channel',tab:'Channels',query:'9019424',visualization:'13064027',description:'Affiliate and distribution fees by referral label over 30 completed UTC days. Excludes separate protocol fees.'}
];
export const glanceGroups=[
  {id:'capital',title:'Capital on NEAR',chartIds:['defi-capital','stablecoins']},
  {id:'activity',title:'Intents activity',chartIds:['intents-volume','intents-fees']},
  {id:'composition',title:'Capital composition',chartIds:['defi-mix','stablecoin-mix']},
  {id:'reach',title:'Cross-chain reach',chartIds:['chain-mix','token-mix']},
  {id:'distribution',title:'Distribution',chartIds:['distribution']}
];

export default function DuneGlance(){
  const [selected,setSelected]=useState({});
  return <section className="thesis-data" aria-labelledby="thesis-data-title">
    <header><div><h2 id="thesis-data-title">NEAR at a glance</h2><p>Capital, activity and the routes connecting them.</p></div><a href="https://dune.com/0xpanatagama/near-economic-monitor" rel="noreferrer">Dune dashboard</a></header>
    <div className="thesis-data-grid">{glanceGroups.map(group=>{
      const chart=glanceCharts.find(chart=>chart.id===(selected[group.id]||group.chartIds[0]));
      const query=`https://dune.com/queries/${chart.query}/${chart.visualization}`;
      return <article className={'glance-tile glance-'+group.id} key={group.id} aria-labelledby={'glance-'+group.id+'-title'}>
        <div className="glance-tile-head"><h3 id={'glance-'+group.id+'-title'}>{group.title}</h3>
          {group.chartIds.length>1&&<div className="glance-switch" role="group" aria-label={group.title+' metrics'}>{group.chartIds.map(id=>{const option=glanceCharts.find(chart=>chart.id===id);return <button key={id} aria-pressed={chart.id===id} aria-controls={'glance-'+group.id+'-chart'} onClick={()=>setSelected(previous=>({...previous,[group.id]:id}))}>{option.tab}</button>;})}</div>}
          <p>{chart.description}</p>
        </div>
        <a className="glance-chart" id={'glance-'+group.id+'-chart'} href={query} rel="noreferrer" aria-label={'Open '+chart.title+' query on Dune'}>
          <iframe key={chart.id} title={chart.title+' — Dune visualization'} src={`https://dune.com/embeds/${chart.query}/${chart.visualization}`} loading="lazy" referrerPolicy="no-referrer" tabIndex="-1" aria-hidden="true"/>
        </a>
        <a className="glance-query" href={query} rel="noreferrer" aria-label={'View '+chart.title+' query on Dune'}>View query on Dune</a>
      </article>;
    })}</div>
    <p className="dune-freshness">Charts are served by Dune. Freshness follows each query’s latest successful execution.</p>
  </section>;
}
