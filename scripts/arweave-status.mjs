#!/usr/bin/env node
/** Read-only Italian overview of the Arweave NFT release. No uploads or keys. */
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {nextArweaveStep} from './lib/arweave-status.mjs';
const ROOT=resolve(dirname(fileURLToPath(import.meta.url)),'..');
async function get(file){
 try{const bytes=await readFile(resolve(ROOT,file));return {bytes,doc:JSON.parse(bytes.toString('utf8'))}}
 catch(e){if(e.code==='ENOENT')return null;throw e}
}
const sha=b=>createHash('sha256').update(b).digest('hex');
const fresh=(date,hours)=>{const t=Date.parse(date);return Number.isFinite(t)&&Date.now()>=t&&Date.now()-t<=hours*3600000};
async function main(){
 const base='reports/arweave-one-time/';
 const [cat,historic,images,inv,media,stage,metadata,manifest,remote,atomic,uri,chain,lock,mediaLock,metadataLock]=await Promise.all([
  get('reports/staging-mint-plan.json'),
  get('reports/solar-release-staging/historic-originals/manifest.json'),
  get('reports/solar-release-staging/historic-originals/media-report.json'),
  get(base+'inventory.json'),get(base+'receipts-media.json'),
  get(base+'metadata-stage-report.json'),get(base+'receipts-metadata.json'),
  get(base+'release-report.json'),get(base+'remote-verification.json'),
  get('reports/atomic-fork-proof.json'),get(base+'baseuri-fork-proof.json'),
  get('reports/onchain-new-ids-audit.json'),get(base+'manifest-upload-inflight.json'),
  get(base+'receipts-media.json.lock'),get(base+'receipts-metadata.json.lock')
 ]);
 const validInv=inv?.doc?.status==='LOCAL_ARWEAVE_INVENTORY_READY'&&
  inv.doc.artworks?.length===2358&&inv.doc.historical?.length===19;
 const goodMedia=validInv&&media?.doc?.inventory_sha256===sha(inv.bytes);
 const goodMetadata=validInv&&stage&&metadata?.doc?.inventory_sha256===sha(inv.bytes)&&
  metadata.doc.metadata_stage_sha256===sha(stage.bytes);
 const numMedia=goodMedia?Object.keys(media.doc.records??{}).length:0;
 const numMeta=goodMetadata?Object.keys(metadata.doc.records??{}).length:0;
 const totalMedia=validInv?inv.doc.media.length:null;
 const status={
  catalog:cat?.doc?.pending?.length===2358,
  historic:historic?.doc?.existing_count===19,
  images:images?.doc?.original_nft_count===19,
  inventory:!!validInv,
  media:!!(goodMedia&&numMedia===totalMedia),
  composed:stage?.doc?.count===2377,
  metadata:!!(goodMetadata&&numMeta===2377),
  manifest:manifest?.doc?.status==='ARWEAVE_UPLOADED_PENDING_INDEPENDENT_VERIFICATION',
  remote:remote?.doc?.status==='ARWEAVE_2_GATEWAY_BYTES_VERIFIED'&&
   remote.doc.scope==='FULL'&&fresh(remote.doc.checked_at,24),
  forkAtomic:atomic?.doc?.status==='LOCAL_ATOMIC_FORK_PROOF_PASSED'&&fresh(atomic.doc.created_at,168),
  forkURI:uri?.doc?.status==='LOCAL_ARWEAVE_BASEURI_FORK_PASSED'&&fresh(uri.doc.created_at,168),
  chain:chain?.doc?.read_only===true&&fresh(chain.doc.created_at,12),
  unresolved:!!(lock||mediaLock||metadataLock||media?.doc?.inflight||metadata?.doc?.inflight||
   (media&&!goodMedia)||(metadata&&!goodMetadata))
 };
 const result={mode:'LOCAL_READ_ONLY',
  original_json_records:status.historic?19:0,original_image_records:status.images?19:0,
  media_uploaded:numMedia,media_total:totalMedia,
  metadata_uploaded:numMeta,metadata_total:2377,
  manifest_uploaded:!!status.manifest,remote_full_current:!!status.remote,
  unresolved_paid_upload:status.unresolved,
  next_safe_command:nextArweaveStep(status),new_payments:0,new_uploads:0,mainnet_transactions:0};
 if(process.argv.includes('--json'))console.log(JSON.stringify(result,null,2));
 else{
  console.log('RISUONATORE SOLARE | Arweave senza canoni');
  console.log('Storici: '+result.original_json_records+'/19 JSON; '+result.original_image_records+'/19 immagini');
  console.log('Immagini: '+numMedia+'/'+(totalMedia??'da preparare'));
  console.log('Metadata: '+numMeta+'/2377');
  console.log('Manifest: '+(result.manifest_uploaded?'presente':'non caricato'));
  console.log('Prova completa gateway: '+(result.remote_full_current?'recente':'mancante/scaduta'));
  console.log('Upload incerto: '+(result.unresolved_paid_upload?'STOP: verifica necessaria':'nessuno rilevato'));
  console.log('PROSSIMO PASSO: '+result.next_safe_command);
 }
}
main().catch(e=>{console.error('ARWEAVE STATUS STOPPED: '+e.message);process.exitCode=1});
