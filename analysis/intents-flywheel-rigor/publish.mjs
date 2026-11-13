import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root=fileURLToPath(new URL('../../',import.meta.url));
const read=file=>JSON.parse(readFileSync(path.join(root,file),'utf8'));
const hash=file=>createHash('sha256').update(readFileSync(path.join(root,file))).digest('hex');
const folder='analysis/intents-flywheel-rigor/';
const financial=read(folder+'statistics-result.json'),identification=read(folder+'identification.json');
const eventAudit=read(folder+'event-audit.json'),receiptValidation=read(folder+'rpc-reconciliation.json');
const snapshot=read('data/intents-flywheel.json');
for(const source of [...financial.inputs,...identification.inputs,...eventAudit.lineage]){
  assert(!path.isAbsolute(source.file)&&!source.file.split(/[\\/]/).includes('..'),'Input must remain in repository');
  assert.equal(hash(source.file),source.sha256,'Stale analysis input: '+source.file);
}
const close=(a,b)=>assert(Math.abs(a-b)<Math.max(1e-8,Math.abs(b)*1e-10),'Unreconciled calculation');
const s=financial.summary,m=s.reportingMix;
assert.equal(s.currentWindow.end,snapshot.summary.windowEnd);
assert.equal(s.currentWindow.start,snapshot.summary.windowStart);
assert.equal(identification.sourceWindow.end,snapshot.summary.publicWindowEnd);
close(s.currentFeePerMillionUsd,snapshot.summary.grossFeePerMillion30d);
close(m.netWithinClassIntensityEffectPerMillionUsd+m.netVolumeMixEffectPerMillionUsd+m.unattributedProtocolIntensityEffectPerMillionUsd,m.observedRateChangePerMillionUsd);
assert.equal(receiptValidation.matchedDuneEvents,4);
assert.equal(receiptValidation.verifiedSignedPayloadHashes,receiptValidation.matchedDuneEvents);
assert.equal(receiptValidation.ed25519SignaturesVerified,receiptValidation.matchedDuneEvents);
assert.equal(financial.causalIdentification,false);
assert.equal(identification.causalIdentification,false);
const files=['statistics-result.json','identification.json','event-audit.json','rpc-reconciliation.json','11_fee_component_panel.sql'];
const result={version:'near-intents-rigor-v1',retrievedAt:snapshot.retrievedAt,financial,identification,eventAudit,receiptValidation,
  componentQuery:'https://dune.com/queries/9120971',
  reproduction:{commands:['python analysis/intents-flywheel-rigor/statistics.py --check','python analysis/intents-flywheel-rigor/identification.py --check','python analysis/intents-flywheel-rigor/check-event-audit.py','node analysis/intents-flywheel-rigor/publish.mjs --check'],pythonPackages:{numpy:financial.runtime.numpy,cryptography:'Ed25519 verification; installed runtime'},ciScope:'Node checks recorded input hashes and accounting identities; Python statistical and signature checks run separately.'},
  sourceFiles:files.map(file=>({file:folder+file,sha256:hash(folder+file)}))};
const encoded=JSON.stringify(result,null,2)+'\n',target=path.join(root,'data/intents-flywheel-rigor.json');
assert(!encoded.toLowerCase().includes('bitwise'),'Excluded research reference');
if(process.argv.includes('--check'))assert.equal(readFileSync(target,'utf8'),encoded,'Stale published rigor artifact');
else writeFileSync(target,encoded);
console.log('Rigor artifact: input hashes, matched windows, fee decomposition and recorded receipt-validation checks passed.');
