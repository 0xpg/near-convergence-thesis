export const modelVersion = '1.0.0';
export const defaults = Object.freeze({volumeGrowthPct:0,grossFeeBps:15.920109215831174,receiptSharePct:32.80748534576389,costSharePct:0,purchaseSharePct:0,retentionSharePct:100,issuancePct:2.5,priceUsd:4.44,hurdlePct:2,horizonYears:1});
export const formulas = Object.freeze({volume:'snapshot volume × 365 / 30 × (1 + growth / 100)^years',grossFees:'annual volume × gross fee bps / 10,000',walletReceipts:'gross fees × receipt share / 100',retainedPurchases:'wallet receipts × (1 − additional cost share / 100) × purchase share / 100 × retention share / 100',issuance:'snapshot supply × issuance rate / 100 (annual ceiling)',absorption:'hypothetical retained purchases / (snapshot supply × reference price)',requiredVolume:'reference total value × selected absorption hurdle / retained purchases per dollar of notional'});
export function calculate(overrides={}, snapshot) {
  if (!snapshot || snapshot.modelVersion !== modelVersion || !snapshot.snapshotVersion || !snapshot.window || snapshot.window.days !== 30 || !Number.isFinite(Date.parse(snapshot.window.start)) || !Number.isFinite(Date.parse(snapshot.window.end)) || Date.parse(snapshot.window.end)-Date.parse(snapshot.window.start)!==29*86400000 || !Number.isFinite(snapshot.supplyNear) || snapshot.supplyNear <= 0 || !Number.isFinite(snapshot.volumeUsd) || snapshot.volumeUsd <= 0 || !Number.isFinite(snapshot.feesUsd) || snapshot.feesUsd <= 0 || !Number.isFinite(snapshot.walletReceiptsUsd) || snapshot.walletReceiptsUsd < 0 || snapshot.walletReceiptsUsd>snapshot.feesUsd || !snapshot.market || !Number.isFinite(snapshot.market.priceUsd) || snapshot.market.priceUsd<=0 || !Number.isFinite(snapshot.maximumIssuancePct)) throw new RangeError('A valid compatible 30-day documented snapshot is required');
  const inputs={...defaults,grossFeeBps:snapshot.feesUsd/snapshot.volumeUsd*10000,receiptSharePct:snapshot.walletReceiptsUsd/snapshot.feesUsd*100,priceUsd:snapshot.market.priceUsd,issuancePct:snapshot.maximumIssuancePct,...overrides};
  for (const [key,value] of Object.entries(inputs)) {
    if (!(key in defaults) || !Number.isFinite(value)) throw new RangeError('Invalid model input: '+key);
    const min=key==='volumeGrowthPct' ? -100 : 0;
    const max=key==='volumeGrowthPct' ? 500 : key==='priceUsd' ? 100000 : key==='grossFeeBps' ? 10000 : key==='horizonYears' ? 10 : 100;
    if(value < min || value > max || (key==='priceUsd' && value===0)) throw new RangeError('Input out of range: '+key);
  }
  const volume=snapshot.volumeUsd*365/snapshot.window.days*(1+inputs.volumeGrowthPct/100)**inputs.horizonYears;
  const grossFees=volume*inputs.grossFeeBps/10000;
  const walletReceipts=grossFees*inputs.receiptSharePct/100;
  const purchaseBudget=walletReceipts*(1-inputs.costSharePct/100)*inputs.purchaseSharePct/100;
  const retainedPurchases=purchaseBudget*inputs.retentionSharePct/100;
  const issuanceNear=snapshot.supplyNear*inputs.issuancePct/100;
  const referenceValue=snapshot.supplyNear*inputs.priceUsd;
  const netBps=inputs.grossFeeBps*inputs.receiptSharePct/100*(1-inputs.costSharePct/100)*inputs.purchaseSharePct/100*inputs.retentionSharePct/100;
  return {modelVersion,snapshotVersion:snapshot.snapshotVersion,inputs,volume,grossFees,walletReceipts,purchaseBudget,retainedPurchases,issuanceNear,referenceValue,absorptionPctOfValue:retainedPurchases/referenceValue*100,issuanceValueAtReferencePrice:issuanceNear*inputs.priceUsd,fundingOffsetPct:issuanceNear ? retainedPurchases/(issuanceNear*inputs.priceUsd)*100 : null,netBps,requiredVolume:netBps>0 ? referenceValue*inputs.hurdlePct/100/(netBps/10000) : null,purchaseShareStatus:'hypothetical, not observed',gasBurnNear:null,netSupplyGrowthNear:null};
}
