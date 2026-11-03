import {calculate} from '../analysis/model.mjs';

export const controls = [
  ['volumeGrowthPct','Annual volume growth','% per year · hypothetical',-100,500],
  ['grossFeeBps','Gross service fee','Basis points · route mix can change',0,10000],
  ['receiptSharePct','Wallet-receipt share','% of gross fees · historical proxy',0,100],
  ['costSharePct','Additional costs','% of receipts · not already netted',0,100],
  ['purchaseSharePct','NEAR purchase allocation','% after costs · Unverified · hypothetical',0,100],
  ['retentionSharePct','Purchased tokens retained','% not subsequently distributed or resold',0,100],
  ['issuancePct','Maximum annual issuance','% of snapshot supply · not realized growth',0,100],
  ['priceUsd','Reference token price','USD · saved 25 Oct price, editable',.01,100000],
  ['hurdlePct','Absorption hurdle','% of reference total value · analyst choice',0,100],
  ['horizonYears','Compounding horizon','Years of volume growth · annual output',0,10]
];

export const presets = {
  unverified: {label:'No unverified credit', inputs:{}},
  partial: {label:'Partial capture', inputs:{purchaseSharePct:50,costSharePct:20,retentionSharePct:50}},
  stress: {label:'Fee compression', inputs:{grossFeeBps:8,purchaseSharePct:50,costSharePct:40,retentionSharePct:50}}
};

export function scenarioResult(values,snapshot) {
  const inputs = Object.fromEntries(controls.map(([key,, ,min,max])=>{
    const raw=values[key],value=Number(raw);
    if(raw===''||raw===null||raw===undefined||!Number.isFinite(value)||value<min||value>max)throw new RangeError('Enter a number within the displayed input limits. Results retain the last valid scenario.');
    return [key,value];
  }));
  return calculate(inputs,snapshot);
}
