import React,{useState} from 'react';
import './dune-glance.css';
import evidence from '../data/glance-insights.json';

export const glanceCharts=[
  {id:'defi-capital',title:'DeFi capital',tab:'TVL',query:'9074769',visualization:'13123658',description:'USD value in tracked NEAR DeFi. Changes reflect prices and balances, not net deposits.'},
  {id:'stablecoins',title:'Stablecoins on NEAR',tab:'Stablecoins',query:'9074817',visualization:'13123708',description:'Tracked stablecoin circulation in USD. A balance measure that can overlap DeFi TVL.'},
  {id:'intents-volume',title:'Intents trading volume',tab:'Volume',query:'9074920',visualization:'13123827',description:'Daily cross-chain trading notional. Service activity, not NEAR token demand.'},
  {id:'intents-fees',title:'Intents gross fees',tab:'Gross fees',query:'9074947',visualization:'13123862',description:'Protocol and distribution fees in USD. Gross fees are not tokenholder revenue.'},
  {id:'defi-mix',title:'DeFi deployment by protocol',tab:'DeFi products',query:'9074882',visualization:'13123784',description:'Balances across tracked DeFi products. Excludes bridges and staking; product overlap may remain.'},
  {id:'stablecoin-mix',title:'Stablecoin mix',tab:'Stablecoins',query:'9074892',visualization:'13123797',description:'Tracked USD stablecoin balances. Native and bridged forms may be aggregated.'},
  {id:'chain-mix',title:'Intents volume by blockchain',tab:'Chains',query:'9074985',visualization:'13123905',description:'Reported source-chain labels over 30 completed UTC days. This is not NEAR L1 settlement volume.'},
  {id:'token-mix',title:'Intents volume by token',tab:'Tokens',query:'9074968',visualization:'13123885',description:'Reported token-symbol mix over 30 completed UTC days, using source-provided labels.'},
  {id:'distribution',title:'Fees by distribution channel',tab:'Channels',query:'9075009',visualization:'13123927',description:'Affiliate and distribution fees by referral label over 30 completed UTC days. Excludes separate protocol fees.'},
  {id:'base-activity',title:'Base-chain activity',tab:'Activity',query:'9075785',visualization:'13124768',description:'Distinct transaction hashes by receipt-execution date, across seven completed UTC dates. Includes all outcomes; origins can include relayers.'},
  {id:'total-supply',title:'Finalized total supply',tab:'Total supply',query:'9075773',visualization:'13124756',description:'Finalized NEAR RPC total supply with an exact block reference. Not circulating or locked supply.'}
];
export const glanceGroups=[
  {id:'capital',title:'Capital on NEAR',chartIds:['defi-capital','stablecoins']},
  {id:'activity',title:'Intents activity',chartIds:['intents-volume','intents-fees']},
  {id:'composition',title:'Capital composition',chartIds:['defi-mix','stablecoin-mix']},
  {id:'reach',title:'Cross-chain reach',chartIds:['chain-mix','token-mix']},
  {id:'distribution',title:'Distribution',chartIds:['distribution']},
  {id:'network',title:'Network fundamentals',chartIds:['base-activity','total-supply']}
];

export default function DuneGlance(){
  const [selected,setSelected]=useState({});
  return <section className="thesis-data" aria-labelledby="thesis-data-title">
    <header><div><h2 id="thesis-data-title">NEAR at a glance</h2><p>Capital, network activity and the economics of Intents.</p></div><a href="https://dune.com/0xpanatagama/near-economic" rel="noreferrer">Dune dashboard</a></header>
    <div className="thesis-data-grid">{glanceGroups.map(group=>{
      const chart=glanceCharts.find(chart=>chart.id===(selected[group.id]||group.chartIds[0]));
      const insight=evidence.insights[chart.id];
      const query=`https://dune.com/queries/${chart.query}/${chart.visualization}`;
      return <article className={'glance-tile glance-'+group.id} key={group.id} aria-labelledby={'glance-'+group.id+'-title'}>
        <div className="glance-tile-head"><h3 id={'glance-'+group.id+'-title'}>{group.title}</h3>
          {group.chartIds.length>1&&<div className="glance-switch" role="group" aria-label={group.title+' metrics'}>{group.chartIds.map(id=>{const option=glanceCharts.find(chart=>chart.id===id);return <button key={id} aria-pressed={chart.id===id} aria-controls={'glance-'+group.id+'-chart'} onClick={()=>setSelected(previous=>({...previous,[group.id]:id}))}>{option.tab}</button>;})}</div>}
          {insight?<div className="glance-insight" aria-live="polite"><strong>{insight.value}</strong><p className="glance-observation">{insight.headline}</p><small>{insight.date}</small><details><summary>Evidence & calculation</summary><p>{chart.description} {insight.limitation}</p><p>{insight.calculation.method}</p><a href={insight.source} rel="noreferrer">Snapshot source</a><a href="data/glance-insights.json" download>Download calculations</a></details></div>:<p>{chart.description}</p>}
        </div>
        <div className="glance-chart" id={'glance-'+group.id+'-chart'}>
          <iframe key={chart.id} title={chart.title+' — Dune visualization'} src={`https://dune.com/embeds/${chart.query}/${chart.visualization}`} loading="lazy" referrerPolicy="no-referrer"/>
        </div>
        <a className="glance-query" href={query} rel="noreferrer" aria-label={'View '+chart.title+' query on Dune'}>View query on Dune</a>
      </article>;
    })}</div>
    <p className="dune-freshness">Insights use the dated snapshots shown above. Dune charts show each query’s last successful run and may contain newer data. Changing a chart’s internal time window does not recalculate the snapshot insight.</p>
  </section>;
}
