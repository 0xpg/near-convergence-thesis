export function windowSeries(metric,days){if(![30,90,180].includes(days))throw new RangeError('Invalid window');const cutoff=Date.parse(metric.series.at(-1).date)-((days-1)*86400000);return metric.series.filter(row=>Date.parse(row.date)>=cutoff);}
export function change(series){const first=series[0].value,last=series.at(-1).value;return first===0?null:(last/first-1)*100;}
export function csvFor(metric,series){return 'date_utc,value_usd\n'+series.map(row=>row.date+','+row.value).join('\n')+'\n';}
export const money=value=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',notation:'compact',minimumFractionDigits:2,maximumFractionDigits:2}).format(value);

export function indexAtSvgX(x,count,width=800){return Math.max(0,Math.min(count-1,Math.round((x-56)/(width-56-18)*(count-1))));}
