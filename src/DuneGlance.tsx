import React,{useState} from 'react';
import './dune-glance.css';
import evidence from '../data/glance-insights.json';
import {GlanceScorecard,GlanceRetention,GlanceValidation} from './GlanceEconomics.tsx';
import {analyzeWindow} from './glance-analytics.ts';
import {useGlanceSnapshot} from './glance-data.ts';

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

function byId<T extends {id:string}>(list:T[],id:string):T{
  const found=list.find(item=>item.id===id);
  if(!found)throw new Error('Unknown glance item: '+id);
  return found;
}

export const glanceChapters=[
  {id:'execution',title:'Execution across chains',context:'How much trading NEAR Intents settles, where it comes from and who brings it.',items:['activity','reach','distribution']},
  {id:'economics',title:'Revenue and retention',context:'What users pay, what the protocol keeps and how that compares with new issuance.',items:['retention','revenue','issuance']},
  {id:'capital',title:'Capital on NEAR',context:'Liquidity held on the base chain, separate from the inventory that fills Intents.',items:['capital','composition']},
  {id:'network',title:'Network and token',context:'Base-chain activity and the token’s supply and price.',items:['network','token']}
];

const chapterIcons={
  execution:<><path d="M3 7h13l-3-3M21 17H8l3 3"/><circle cx="19" cy="7" r="1.6"/><circle cx="5" cy="17" r="1.6"/></>,
  economics:<><path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/><path d="M16 9.5l3-3 3 3" /></>,
  capital:<><path d="M12 3l9 4.5-9 4.5-9-4.5z"/><path d="M3 12l9 4.5 9-4.5M3 16.5L12 21l9-4.5"/></>,
  network:<><circle cx="5" cy="6" r="2"/><circle cx="19" cy="6" r="2"/><circle cx="12" cy="18" r="2"/><path d="M7 6h10M6 7.8l5 8.4M18 7.8l-5 8.4"/></>
};

const categories={capital:'Liquidity',revenue:'Economics',issuance:'Economics',network:'Network',token:'Market',activity:'Intents',composition:'Liquidity',reach:'Intents',distribution:'Intents'};

type Insight={value:string,headline:string,date:string,limitation:string,source:string,snapshot?:string,calculation:{method:string,[key:string]:unknown}};

function metricTakeaway(id:string,insight:Insight){
  const c=insight.calculation,n=(key:string)=>typeof c[key]==='number'||typeof c[key]==='string'?Number(c[key]):NaN;
  const share=(a:string,b:string)=>Number.isFinite(n(a))&&Number.isFinite(n(b))&&n(b)>0?n(a)/n(b)*100:null;
  if(id==='defi-capital'||id==='stablecoins'){
    const change=n('change_pct');
    return Number.isFinite(change)?`The tracked ${id==='stablecoins'?'stablecoin':'DeFi'} capital base ${change>=0?'expanded':'contracted'} ${Math.abs(change).toFixed(1)}% across the stated window. ${id==='stablecoins'?'The next economic test is whether this liquidity supports more paid transfers and execution.':'A price-and-balance decomposition is needed to establish whether the change reflects capital allocation or asset repricing.'}`:'The source does not support a comparable period-change inference.';
  }
  if(id==='ir-emissions'||id==='ir-coverage'){
    const covered=share('revenue_near','emissions_near');
    return covered===null?'Revenue coverage is unavailable without matched issuance observations.':`Reported revenue was ${covered.toFixed(1)}% of issuance on the source’s NEAR-denominated basis. ${covered<100?'Current receipts leave a substantial gap for the revenue-led investment argument to close.':'Reported coverage exceeded issuance, but a verified burn and supply ledger is still required to establish dilution offset.'}`;
  }
  if(id==='ir-fee-sources'){
    const s=share('intents_fees_near','total_fees_near');
    return s===null?'Fee-source shares require a complete comparable denominator.':`Intents accounts for ${s.toFixed(1)}% of the cumulative reported fee base. The economic case therefore depends on cross-chain fee capture, beyond native transaction activity alone.`;
  }
  if(id==='ir-cumulative'){
    const s=share('revenue_near','fees_near');
    return s===null?'Cumulative capture requires matched fee and revenue coverage.':`The source reports captured revenue equal to ${s.toFixed(1)}% of cumulative fees in NEAR. The difference is an accounting observation; it cannot by itself allocate value between partners, solvers and timing effects.`;
  }
  if(id==='ir-channels'||id==='ir-chains'||id==='ir-tokens'||id==='defi-mix'||id==='stablecoin-mix'){
    const s=share('selected_usd','total_usd')??n('share_pct');
    return Number.isFinite(s)?`The selected ${id==='ir-channels'?'channel':'asset or product'} accounts for ${s.toFixed(1)}% of this source-defined total. ${id==='ir-channels'?'That concentration makes channel retention and bargaining power material to recurring economics.':id==='ir-chains'||id==='ir-tokens'?'This is a labelled activity share; confirming whether both swap legs are counted is necessary before interpreting it as an origin-market share.':'The breadth of the capital base depends on how the remaining balance is distributed, not the headline total alone.'}`:'The source does not establish a comparable concentration share.';
  }
  const implications:Record<string,string>={
    'ir-fees':'Gross fees measure monetized usage. The captured-receipts analysis above tests how much of that activity reaches the protocol over a matched window.',
    'ir-revenue':'These are captured receipts, whose collection date may lag the underlying trade. A purchase-and-disposition ledger is needed to connect the receipts to lasting token demand.',
    'ir-wallets':'Wallet concentration identifies where captured value is collected; it does not establish whether the funds were bought, held, staked or burned.',
    'ir-transactions':'The stronger economic signal pairs transaction activity with paid execution and fees. Application-level attribution is needed to distinguish changes in demand from changes in one high-volume product.',
    'ir-accounts':'Activity is concentrated or broad only relative to the participating applications and counterparties. Account counts alone do not identify distinct people or durable economic users.',
    'ir-gas':'Native gas monetizes base-chain execution. Comparing it with captured Intents receipts shows which part of the stack contributes to the observed economic base.',
    'ir-price':'Price is a market observation. A price-implied investment claim requires a consistent market-cap denominator and verified cash-flow or token-demand mechanism.',
    'ir-supply':'The total-versus-circulating gap describes supply classification at this cutoff. Future issuance, actual vesting and treasury-held tokens require separate ledgers.',
    'ir-volume':'Reported notional establishes the scale of Intents execution. Captured fees per dollar traded and the concentration of activity determine how much economic weight that scale carries.',
    'ir-swaps':'Combining swap count with comparable notional distinguishes more trades from a larger average trade. Neither establishes institutional or agent attribution.',
    'ir-intents-fees':'Gross fees connect trading activity to user spending. Capture rate and collection timing determine how much becomes protocol receipts.'
  };
  return implications[id]||insight.headline;
}

export default function DuneGlance({insights=evidence.insights as Record<string,Insight>,economics=true}:{insights?:Record<string,Insight>,economics?:boolean}={}){
  const [selected,setSelected]=useState({});
  const {snapshot,refreshing,error,refresh}=useGlanceSnapshot();
  const [days,setDays]=useState(30),[selectedEnd,setEnd]=useState<string|null>(null);
  const end=selectedEnd||snapshot.sourceCutoff;
  const analysis=analyzeWindow(snapshot.rows,{days,end,asOf:snapshot.asOf});
  return <section className="thesis-data" aria-labelledby="thesis-data-title">
    <header><div><h2 id="thesis-data-title">NEAR at a glance</h2><p>Activity, capital and the economics connecting them.</p></div><a href="https://dune.com/0xpanatagama/near-economic" rel="noreferrer">Dune dashboard</a></header>
    {economics&&<GlanceScorecard analysis={analysis} days={days} onDaysChange={setDays} end={end} onEndChange={setEnd} maxDate={snapshot.sourceCutoff} sourceVersion={snapshot.version} retrievedAt={snapshot.retrievedAt} onRefresh={refresh} refreshing={refreshing} refreshError={error}/>}
    {glanceChapters.map(chapter=><section className="glance-chapter" key={chapter.id} aria-labelledby={'glance-chapter-'+chapter.id}>
      <header className="glance-chapter-head"><svg className="glance-chapter-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">{chapterIcons[chapter.id]}</svg><h3 id={'glance-chapter-'+chapter.id}>{chapter.title}</h3><p>{chapter.context}</p></header>
      <div className="thesis-data-grid">{chapter.items.map(id=>{
      if(id==='retention')return <GlanceRetention key={id} analysis={analysis} snapshot={snapshot} available={economics}/>;
      const group=byId(glanceGroups,id);
      const chart=byId(glanceCharts,selected[group.id]||group.chartIds[0]);
      const insight=insights[chart.id];
      const query=`https://dune.com/queries/${chart.query}/${chart.visualization}`;
      return <article className={'glance-tile glance-'+group.id} key={group.id} aria-labelledby={'glance-'+group.id+'-title'}>
        <div className="glance-tile-head"><span className="glance-category">{categories[group.id]}</span><h4 id={'glance-'+group.id+'-title'}>{group.title}</h4>
          {group.chartIds.length>1&&<div className="glance-switch" role="group" aria-label={group.title+' metrics'}>{group.chartIds.map(id=>{const option=byId(glanceCharts,id);return <button key={id} aria-pressed={chart.id===id} aria-controls={'glance-'+group.id+'-chart'} onClick={()=>setSelected(previous=>({...previous,[group.id]:id}))}>{option.tab}</button>;})}</div>}
          {insight?<div className="glance-insight" aria-live="polite"><strong>{insight.value}</strong><p className="glance-observation">{insight.headline}</p></div>:<p role="status">Snapshot insight unavailable. The chart and source query remain available.</p>}

        </div>
        <div className="glance-chart" id={'glance-'+group.id+'-chart'}>
          <iframe key={chart.id} title={chart.title+' — Dune visualization'} src={`https://dune.com/embeds/${chart.query}/${chart.visualization}`} loading="lazy" referrerPolicy="no-referrer"/>
        </div>
        {insight&&<blockquote className="glance-takeaway">{metricTakeaway(chart.id,insight)}</blockquote>}
        <footer className="glance-footer">{insight&&<details><summary>Evidence & calculation</summary><p>{insight.date}</p><p>{chart.description} {insight.limitation}</p><p>{insight.calculation.method}</p><a href={insight.source} rel="noreferrer">Source</a>{insight.snapshot&&<a href={insight.snapshot} download>Download source snapshot</a>}<a href="data/glance-insights.json" download>Download calculations</a></details>}<a className="glance-query" href={query} rel="noreferrer" aria-label={'View '+chart.title+' query on Dune'}>View query on Dune</a></footer>
      </article>;
    })}</div>
    </section>)}
    {economics&&<GlanceValidation/>}
    <p className="dune-freshness">The observed-economics controls recalculate the source snapshot above. Each embedded Dune chart has independent controls and freshness; changing an iframe’s internal window does not recalculate the snapshot insight. Source cutoffs for the individual metric cards are in their evidence details.</p>
  </section>;
}
