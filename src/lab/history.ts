import rigor from '../../data/lab-rigor.json' with {type:'json'};

const monthYear=(iso:string)=>new Date(iso.slice(0,7)+'-01T00:00:00Z').toLocaleString('en-US',{month:'short',year:'numeric',timeZone:'UTC'});
const volumeMonths=rigor.backtest.rollingOrigin.months,feeMonths=rigor.econ.months,capture=rigor.econ.capture;

export const dataHistory={
  launch:monthYear(rigor.backtest.rollingOrigin.source.match(/\d{4}-\d{2}-\d{2}/)![0]),volumeSince:monthYear(volumeMonths[0].month),volumeMonths:volumeMonths.length,
  feesSince:monthYear(feeMonths[0].month),feeMonths:feeMonths.length,
  feeSwitch:monthYear(capture.feeSwitchLive),captureP:capture.welch.p
};
