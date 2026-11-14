import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';

const root=new URL('../../',import.meta.url);
const file='analysis/multiple-fade/results.json';
const results=JSON.parse(readFileSync(new URL(file,root),'utf8'));
const groups=results.empirical.groups,protocols=groups.protocol.primary,chains=groups.l1.primary;

const ar1=a=>({phi:a.b_per_year,phiCi95:a.b_ci95,halfLifeYears:a.half_life_years,halfLifeCi95:a.half_life_ci95,pairs:a.n_pairs,entities:a.n_entities,
  ...(a.long_run_multiple?{longRunMultiple:a.long_run_multiple,longRunCi95:a.long_run_multiple_ci95}:{})});
const after=(group,years)=>{const t=group.transitions[`>100x_h${years}y`];assert(t,`Missing ${years}-year transition`);
  return {years,startObservations:t.n_start_obs,startEntities:t.n_start_entities,outcomes:t.n_outcomes,outcomeEntities:t.n_outcome_entities,
    median:t.median,q1:t.q1,q3:t.q3,shareAbove100:t.share_gt_100,shareAbove100Ci95:t.share_gt_100_ci95_cluster??null};};

const cases=Object.fromEntries(Object.entries(results.recommendation).filter(([id])=>['Bear','Base','Bull','Maximum'].includes(id)).map(([id,c])=>[id.toLowerCase(),
  {longRun:c.long_run_L,phi:c.phi_per_year,halfLifeYears:c.half_life_years,basis:c.basis}]));
assert.deepEqual(Object.keys(cases),['bear','base','bull','maximum']);

const theory=results.theory_sources;
const output={
  version:'multiple-fade-1-'+createHash('sha256').update(readFileSync(new URL(file,root))).digest('hex').slice(0,12),
  results:file,preregisteredUtc:results.preregistration.written_utc,rulesSha256:results.preregistration.rules_sha256,
  model:'ln M(t) = ln L + (ln M0 - ln L) * phi^t, with t in years from the snapshot',
  multipleDefinition:results.empirical.rules.multiple_definition,
  panel:{protocols:{observations:protocols.n_obs,entities:protocols.n_entities},chains:{observations:chains.n_obs,entities:chains.n_entities}},
  ar1:{protocols:ar1(protocols.ar1_primary),protocolsMarketNeutral:ar1(protocols.ar1_relative_to_date_mean),protocolsDecember:ar1(protocols.ar1_december_only),chains:ar1(chains.ar1_primary)},
  above100:{protocols:[1,2,3].map(y=>after(protocols,y)),chains:[1,3].map(y=>after(chains,y))},
  crossSection:{month:'2026-10',protocols:protocols.cross_section_2026_10,chains:chains.cross_section_2026_10},
  cases,
  consistency:{payout:1,stableGrowth:.03,
    impliedRequiredReturn:Object.fromEntries(['100','200','250'].map(m=>[m,results.current_preset_implications[m].implied_r_if_g_3pct])),
    yearsOfGrowthAfterExit:Object.fromEntries(['25','100','200'].map(m=>[m,results.two_stage_years_of_high_growth_needed[`M=${m},r=0.15,g_high=0.3,g_stable=0.03`]])),
    twoStage:'Years of 30% annual receipt growth needed after the exit to justify the multiple at a 15% mature required return and 3% stable growth.'},
  sources:[
    {label:'Damodaran, Investment Valuation, ch. 12',url:theory.Damodaran_InvestmentValuation_ch12.url,page:'p.3',finding:'Terminal multiples taken from comparable firms mix relative and discounted cash-flow valuation; a stable-growth model is the consistent alternative.'},
    {label:'Chan, Karceski and Lakonishok (2003)',url:theory['Chan_Karceski_Lakonishok_2003_JF_58_2_643-684'].url,page:'pp. 643, 649',finding:'No persistence in long-term earnings growth beyond chance; a multiple of 100 falling to 20 over ten years needs about 29% annual growth, near the 95th percentile.'},
    {label:'Fama and French (2000)',url:theory['Fama_French_2000_JBus_73_2_161-175'].url,page:'abstract',finding:'Profitability mean-reverts at about 38% a year.'}],
  limitations:['The panel covers 2020-2026, about one and a half crypto cycles; three-year outcomes rest on few protocols.','Only protocols still listed today are included.','Part of the reversion is mechanical: noise in the revenue denominator pulls extreme multiples back.','Raw market-cap and revenue files are not redistributed; analysis/multiple-fade/raw_sha256.json lists the hash of each file that analysis/multiple-fade/run_all.sh downloads.']
};

const encoded=JSON.stringify(output,null,1)+'\n',target=new URL('data/multiple-fade.json',root);
if(process.argv.includes('--check'))assert.equal(readFileSync(target,'utf8'),encoded,'Multiple fade data is stale: rerun node analysis/multiple-fade/publish.mjs');
else writeFileSync(target,encoded);
console.log(`Multiple fade: ${output.panel.protocols.entities} protocols, half-life ${output.ar1.protocols.halfLifeYears} years.`);
