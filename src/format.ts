const formatter=(options:Intl.NumberFormatOptions)=>new Intl.NumberFormat('en-US',options);
export const formatCompact=(value:number,digits=1)=>formatter({notation:'compact',maximumFractionDigits:digits}).format(value);
export const formatUsdCompact=(value:number,digits=1)=>formatter({style:'currency',currency:'USD',notation:'compact',maximumFractionDigits:digits}).format(value);
export const formatPrice=(value:number)=>formatter({style:'currency',currency:'USD',maximumFractionDigits:2}).format(value);
export const clamp01=(value:number)=>Math.max(0,Math.min(1,value));
