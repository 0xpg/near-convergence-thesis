import React from 'react';

export const glanceCharts=[
  {id:'defi-capital',title:'DeFi capital',query:'9012791',visualization:'13057058',description:'USD value in tracked NEAR DeFi. Changes reflect prices and balances, not net deposits.'},
  {id:'stablecoins',title:'Stablecoins on NEAR',query:'9012810',visualization:'13057075',description:'Tracked stablecoin circulation in USD. A balance measure that can overlap DeFi TVL.'},
  {id:'intents-volume',title:'Intents trading volume',query:'9019417',visualization:'13064021',description:'Daily cross-chain trading notional. Service activity, not NEAR token demand.'},
  {id:'intents-fees',title:'Intents gross fees',query:'9019419',visualization:'13064023',description:'Protocol and distribution fees in USD. Gross fees are not tokenholder revenue.'}
];

export default function DuneGlance(){
  return <section className="thesis-data" aria-labelledby="thesis-data-title">
    <header><div><h2 id="thesis-data-title">NEAR at a glance</h2><p>Capital depth, cross-chain activity and service fees.</p></div><a href="https://dune.com/0xpanatagama/near-economic-monitor" target="_blank" rel="noopener noreferrer">Dune dashboard</a></header>
    <div className="thesis-data-grid">{glanceCharts.map(chart=><a className="dune-card" key={chart.id} href={`https://dune.com/queries/${chart.query}/${chart.visualization}`} rel="noreferrer" aria-labelledby={chart.id+'-title'} aria-describedby={chart.id+'-description'}>
      <div className="dune-card-copy"><h3 id={chart.id+'-title'}>{chart.title}</h3><p id={chart.id+'-description'}>{chart.description}</p></div>
      <div className="dune-card-chart">
        <iframe title={chart.title+' — Dune visualization'} src={`https://dune.com/embeds/${chart.query}/${chart.visualization}`} loading="lazy" referrerPolicy="no-referrer" tabIndex="-1" aria-hidden="true"/>
      </div>
      <span className="dune-card-source">View query on Dune</span>
    </a>)}</div>
    <p className="dune-freshness">Charts are served by Dune. Freshness follows each query’s latest successful execution.</p>
  </section>;
}
