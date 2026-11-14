import baseline from '../../data/lab-baseline.json' with {type:'json'};
import institutional from '../../data/institutional-demand.json' with {type:'json'};
import {buildValuationCases} from './valuation.ts';

export const HOLDINGS_BASELINE_ID=`nrr:${institutional.nrr.holdingsIssuerDate}:${institutional.nrr.nearHeld}`;
export const STARTING={asOf:baseline.supply.blockUtc.slice(0,10),annualVolumeUsd:baseline.operating.windows[0].volumeUsd*365/30,annualReceiptsUsd:baseline.operating.windows[0].annualizedCapturedUsd,supplyNear:baseline.supply.supplyNear,spotPriceUsd:baseline.market.priceUsd,institutionalHoldingsNear:institutional.nrr.nearHeld,grossBps:baseline.operating.windows[0].grossBps,capturePct:baseline.operating.windows[0].cashCapturePct};
export const VAL_DEFAULTS={...buildValuationCases(STARTING).find(c=>c.id==='base')!.inputs};
