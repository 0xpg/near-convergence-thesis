export const MOCK=Object.freeze({
  status:'Mock baseline. Illustrative inputs, not measured data.',
  cryptoVolume30d:4.0e9,
  supply:1.311e9,
  solvers:18,
  spreadBps:9
});

export type RouteSpec={id:string,name:string,share:'shareStable'|'shareMajors'|null,bps:'bpsStable'|'bpsMajors'|'bpsLong'};

export const ROUTES:readonly RouteSpec[]=Object.freeze([
  {id:'stable',name:'Stablecoin routes',share:'shareStable',bps:'bpsStable'},
  {id:'majors',name:'Majors',share:'shareMajors',bps:'bpsMajors'},
  {id:'long',name:'Long-tail',share:null,bps:'bpsLong'}
]);

const defaultInputs={
  volumeMultiple:1,compression:.4,
  shareStable:38,shareMajors:44,bpsStable:3,bpsMajors:14,bpsLong:35,
  partnerPayout:73.7,costs:0,buybackAllocation:93,burnShare:0,
  price:3.83,issuancePct:2.5,
  desks:5,ordersPerDesk:20,orderSize:250000,incrementalShare:50,institutionalBps:4,
  agents:10000,intentsPerAgent:4,agentNotional:80,eligibleShare:40,agentBps:12,
  targetMultiple:30,
  solverElasticity:.5,qualityElasticity:.3,responsiveness:.8,distributionGrowth:4
};

export type Inputs=typeof defaultInputs;
export type InputKey=keyof Inputs;
export const DEFAULTS:Readonly<Inputs>=Object.freeze(defaultInputs);

export const LIMITS:Readonly<Record<InputKey,[number,number,number|'log']>>=Object.freeze({
  volumeMultiple:[0,10,.1],compression:[0,1,.05],
  shareStable:[0,100,1],shareMajors:[0,100,1],bpsStable:[0,60,.5],bpsMajors:[0,60,.5],bpsLong:[0,60,.5],
  partnerPayout:[0,100,.1],costs:[0,50,1],buybackAllocation:[0,100,1],burnShare:[0,100,1],
  price:[.5,20,.01],issuancePct:[0,8,.1],
  desks:[0,200,1],ordersPerDesk:[0,200,1],orderSize:[10000,10000000,'log'],incrementalShare:[0,100,1],institutionalBps:[0,20,.5],
  agents:[100,1000000,'log'],intentsPerAgent:[0,50,1],agentNotional:[5,5000,'log'],eligibleShare:[0,100,1],agentBps:[0,40,.5],
  targetMultiple:[2,150,1],
  solverElasticity:[0,1.5,.05],qualityElasticity:[0,1,.05],responsiveness:[0,2,.05],distributionGrowth:[0,20,.5]
});

export const PRESETS=Object.freeze({
  base:{label:'Mock base',inputs:{}},
  compression:{label:'Fee compression',inputs:{volumeMultiple:5,compression:1}},
  institutional:{label:'Institutional pull',inputs:{desks:60,ordersPerDesk:40,orderSize:500000,incrementalShare:60}},
  agents:{label:'Agent economy',inputs:{agents:500000,intentsPerAgent:8,agentNotional:120}},
  commoditized:{label:'Commoditized',inputs:{partnerPayout:90,compression:.8,bpsMajors:8,bpsLong:20}},
  burn:{label:'Buy and burn',inputs:{buybackAllocation:100,burnShare:100}}
});

export const TRADING_DAYS=250;

export function sanitize(inputs?:Partial<Record<InputKey,unknown>>|null):Inputs{
  const clean:Inputs={...DEFAULTS};
  for(const key of Object.keys(DEFAULTS) as InputKey[]){
    const value=Number(inputs?.[key]);
    if(!Number.isFinite(value))continue;
    const [min,max]=LIMITS[key];
    clean[key]=Math.min(max,Math.max(min,value));
  }
  if(clean.shareStable+clean.shareMajors>100)clean.shareMajors=100-clean.shareStable;
  return clean;
}

export function run(inputs=DEFAULTS){
  const a=sanitize(inputs);
  const baselineAnnual=MOCK.cryptoVolume30d*365/30;
  const shares={shareStable:a.shareStable,shareMajors:a.shareMajors,long:Math.max(0,100-a.shareStable-a.shareMajors)};
  const cryptoVolume=baselineAnnual*a.volumeMultiple;
  const institutionalGross=a.desks*a.ordersPerDesk*a.orderSize*TRADING_DAYS;
  const institutionalVolume=institutionalGross*a.incrementalShare/100;
  const agentVolume=a.agents*a.intentsPerAgent*a.agentNotional*365*a.eligibleShare/100;
  const volume=cryptoVolume+institutionalVolume+agentVolume;
  const scale=volume/baselineAnnual;
  const compressionFactor=scale>1?scale**-a.compression:1;
  const routes=ROUTES.map(route=>{
    const share=route.share?shares[route.share]:shares.long,routeVolume=cryptoVolume*share/100,bps=a[route.bps]*compressionFactor;
    return {...route,sharePct:share,volume:routeVolume,bps,fees:routeVolume*bps/10000};
  });
  const cryptoFees=routes.reduce((sum,route)=>sum+route.fees,0);
  const institutionalFees=institutionalVolume*a.institutionalBps*compressionFactor/10000;
  const agentFees=agentVolume*a.agentBps*compressionFactor/10000;
  const grossFees=cryptoFees+institutionalFees+agentFees;
  const payouts=grossFees*a.partnerPayout/100;
  const afterPayouts=grossFees*(1-a.partnerPayout/100);
  const otherCosts=afterPayouts*a.costs/100;
  const retained=afterPayouts*(1-a.costs/100);
  const buybackUsd=retained*a.buybackAllocation/100;
  const tokensBought=buybackUsd/a.price;
  const tokensBurned=tokensBought*a.burnShare/100;
  const issuanceTokens=MOCK.supply*a.issuancePct/100;
  const marketCap=MOCK.supply*a.price;
  const retainedBps=volume?retained/volume*10000:0;
  const requiredRevenue=marketCap/a.targetMultiple;
  return {
    inputs:a,baselineAnnual,cryptoVolume,institutionalGross,institutionalVolume,displacedVolume:institutionalGross-institutionalVolume,agentVolume,volume,scale,compressionFactor,
    routes,cryptoFees,institutionalFees,agentFees,grossFees,payouts,otherCosts,retained,
    grossBps:volume?grossFees/volume*10000:0,retainedBps,retainedPerMillion:volume?retained/volume*1e6:0,
    buybackUsd,tokensBought,tokensBurned,tokensHeld:tokensBought-tokensBurned,issuanceTokens,
    coveragePct:issuanceTokens?tokensBought/issuanceTokens*100:0,netNewTokens:issuanceTokens-tokensBurned,
    marketCap,impliedMultiple:retained>0?marketCap/retained:Infinity,grossMultiple:grossFees>0?marketCap/grossFees:Infinity,
    requiredRevenue,requiredVolume:retainedBps>0?requiredRevenue/(retainedBps/10000):Infinity
  };
}

export function compressionIndex(multiple,compression){return multiple<=1?multiple:multiple**(1-compression);}

export function coverageGrid(inputs,multiples,payouts){
  return payouts.map(partnerPayout=>multiples.map(volumeMultiple=>run({...inputs,volumeMultiple,partnerPayout}).coveragePct));
}

export function supplyPath(inputs,years=5){
  const result=run(inputs),rows:{year:number,withBurn:number,issuanceOnly:number}[]=[];
  let withBurn:number=MOCK.supply,issuanceOnly:number=MOCK.supply;
  for(let year=0;year<=years;year++){
    rows.push({year,withBurn,issuanceOnly});
    issuanceOnly+=issuanceOnly*result.inputs.issuancePct/100;
    withBurn+=withBurn*result.inputs.issuancePct/100-result.tokensBurned;
  }
  return rows;
}

export function flywheel(inputs,rounds=12){
  const a=sanitize(inputs),base=run(a),rows:{round:number,flow:number,solvers:number,spreadBps:number,retainedIndex:number}[]=[];
  let flow=1,previousQuality=1;
  for(let round=0;round<=rounds;round++){
    const solvers=MOCK.solvers*flow**a.solverElasticity;
    const quality=(solvers/MOCK.solvers)**a.qualityElasticity;
    const result=run({...a,volumeMultiple:Math.min(LIMITS.volumeMultiple[1],a.volumeMultiple*flow)});
    rows.push({round,flow,solvers,spreadBps:MOCK.spreadBps/quality,retainedIndex:base.retained?result.retained/base.retained:0});
    flow=flow*(1+a.distributionGrowth/100)*(quality/previousQuality)**a.responsiveness;
    previousQuality=quality;
  }
  return rows;
}
