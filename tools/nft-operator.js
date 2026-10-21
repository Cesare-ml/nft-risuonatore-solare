import {
 CONFIGURER,CONFIGURER_ABI,CONFIGURER_SELECTOR,COLLECTION,
 makeAtomicMintConfig
} from '/configurer.js';
const $=id=>document.getElementById(id);
const msg=text=>{
 $('log').textContent=new Date().toLocaleTimeString()+' · '+text+'\n\n'+$('log').textContent.slice(0,5500);
};
const err=e=>msg('ERRORE: '+(e?.shortMessage||e?.message||String(e)));
let state=null,provider=null,signer=null,contract=null,configurer=null;
let verifiedForBatch=null;
function lock(){
 $('mint').disabled=true;verifiedForBatch=null;
}
function selectedBatch(){
 const n=Number($('batchIndex').value);
 const batches=state?.plan?.operations?.filter(o=>o.kind==='atomic_configure_mint')??[];
 if(!Number.isSafeInteger(n)||n<1||n>batches.length)throw Error('Numero di lotto non presente nel piano');
 const batch=batches[n-1];
 if(batch.to?.toLowerCase()!==CONFIGURER || batch.target_collection?.toLowerCase()!==COLLECTION)
   throw Error('Indirizzo configuratore/collezione errato nel piano');
 if(!Array.isArray(batch.token_ids)||batch.token_ids.length===0||batch.token_ids.length>30)
   throw Error('Lotto non valido');
 return {n,batch};
}
async function preflight(needUri=true){
 if(!provider||!contract||!signer||!configurer)throw Error('Collegare il wallet prima di procedere');
 if((await provider.getNetwork()).chainId!==137n)throw Error('Connettersi a Polygon mainnet, ID 137');
 const owner=await contract.owner();
 const wallet=await signer.getAddress();
 if(wallet.toLowerCase()!==owner.toLowerCase())
   throw Error('Il wallet connesso non è owner() della collezione');
 const onchainConfigurer=await contract.configurer();
 if(onchainConfigurer.toLowerCase()!==CONFIGURER)throw Error('Configurer del contratto modificato: stop');
 if((await provider.getCode(COLLECTION))==='0x'||(await provider.getCode(CONFIGURER))==='0x')
   throw Error('Contratto NFT o configuratore non distribuito su Polygon');
 if(configurer.interface.getFunction('multiConfigure').selector!==CONFIGURER_SELECTOR)
   throw Error('Selector ABI del configuratore incongruente');
 const currentURI=await contract.baseURI();
 $('walletStatus').textContent=
  'Owner connesso: '+wallet+'\nCollezione: '+COLLECTION+
  '\nConfigurer: '+onchainConfigurer+
  '\nURI attuale: '+currentURI+
  '\nURI preparata: '+(state?.plan?.proposed_base_uri||'non disponibile');
 if(needUri){
   if(!state?.tx_gates_satisfied_for_ui)
     throw Error('Pacchetto IPFS locale non verificato: mint bloccato');
   if(currentURI!==state.plan.proposed_base_uri)
     throw Error('Base URI on-chain ancora diversa dal CID preparato; stop. Non cambiare URI senza proteggere i 19 NFT storici.');
 }
 return wallet;
}
async function checkOne(id){
 const [supply,minted,max]=await Promise.all([
   contract.totalSupply(id),contract.totalMinted(id),contract.maxSupply(id)
 ]);
 if(supply!==0n||minted!==0n||max!==0n)
   throw Error('ID '+id+' non disponibile: supply='+supply+' minted='+minted+' max='+max);
}
async function checkBatch({n,batch},needUri=true){
 const recipient=await preflight(needUri);
 for(const id of batch.token_ids)await checkOne(id);
 const target=state.plan.recipient??recipient;
 const config=makeAtomicMintConfig(batch.token_ids,target);
 return {recipient:target,config,ids:batch.token_ids,n};
}
async function feePrompt(ids,gas){
 const fees=await provider.getFeeData();
 const gasPrice=fees.maxFeePerGas??fees.gasPrice;
 if(!gasPrice)throw Error('Impossibile leggere il prezzo del gas');
 const upper=ethers.formatEther(gas*gasPrice);
 return confirm('OpenSea configurer sulla COLLEZIONE ORIGINALE\n'+
  'Mint per '+ids.length+' nuovi NFT.\n'+
  'Gas stimato: '+gas.toString()+
  '\nCosto indicativo (massimo per unità di gas): '+upper+' POL.\n'+
  'I costi effettivi possono variare.\n\nVuoi passare alla conferma MetaMask?');
}
async function connect(){
 if(!window.ethereum||!window.ethers)throw Error('MetaMask o ethers locale non disponibile');
 provider=new ethers.BrowserProvider(window.ethereum);
 await provider.send('eth_requestAccounts',[]);
 signer=await provider.getSigner();
 contract=new ethers.Contract(COLLECTION,[
  'function owner() view returns(address)',
  'function configurer() view returns(address)',
  'function baseURI() view returns(string)',
  'function maxSupply(uint256) view returns(uint256)',
  'function totalMinted(uint256) view returns(uint256)',
  'function totalSupply(uint256) view returns(uint256)'
 ],signer);
 configurer=new ethers.Contract(CONFIGURER,CONFIGURER_ABI,signer);
 await preflight(false);
 msg('Wallet verificato. Le firme restano disabilitate se manca la release IPFS approvata.');
}
if(location.hostname!=='127.0.0.1'){
 document.body.textContent='Console disponibile soltanto su 127.0.0.1';
}else{
 try{
  const response=await fetch('/plan',{cache:'no-store'});
  if(!response.ok)throw Error('Piano non disponibile (HTTP '+response.status+')');
  state=await response.json();
  const batches=state.plan.operations.filter(o=>o.kind==='atomic_configure_mint');
  if(!batches.length)throw Error('Nessun lotto atomic disponibile');
  $('planStatus').textContent=state.plan.totals.selected+' NFT da preparare, '+
    batches.length+' transazioni proposte (una per lotto). '+
    (state.tx_gates_satisfied_for_ui?'Backup IPFS locale verificato.':'Mint BLOCCATO: IPFS e URI da verificare.');
  $('planStatus').className=state.tx_gates_satisfied_for_ui?'good':'warn';
  $('batchInfo').textContent='Lotti disponibili: '+batches.length+'. Dimensione massima 30 token.';
 }catch(e){err(e);$('planStatus').textContent='Preparare il piano NFT sul computer prima di usare la console.'}
 $('batchIndex').addEventListener('change',lock);
 $('connect').onclick=async()=>{lock();try{await connect()}catch(e){err(e)}};
 $('check').onclick=async()=>{lock();try{await preflight(false);msg('Rete, owner e CID controllati.')}catch(e){err(e)}};
 $('preview').onclick=async()=>{
  lock();
  try{
   const choice=selectedBatch();
   const {ids,n}=await checkBatch(choice,false);
   msg('Lotto '+n+': '+ids.length+' ID verificati on-chain liberi.\n'+
     'Il test è in sola lettura; '+(state.tx_gates_satisfied_for_ui?
       'possiamo verificare anche la URI di release.':'mint ancora bloccato: release IPFS non pronta.'));
   if(state.tx_gates_satisfied_for_ui) {
     await preflight(true);verifiedForBatch=n;$('mint').disabled=false;
     msg('Lotto '+n+' pronto alla firma esplicita. Ricontrollerò tutto prima di richiederla.');
   }
  }catch(e){err(e);}
 };
 $('mint').onclick=async()=>{
  $('mint').disabled=true;
  try{
   const choice=selectedBatch();
   if(choice.n!==verifiedForBatch)throw Error('Lotto diverso da quello verificato: ripetere lettura');
   const {config,ids}=await checkBatch(choice,true);
   const gas=await configurer.multiConfigure.estimateGas(COLLECTION,config);
   if(!(await feePrompt(ids,gas)))return;
   const tx=await configurer.multiConfigure(COLLECTION,config);
   msg('Transazione inviata a configuratore: '+tx.hash);
   const receipt=await tx.wait(1);
   if(receipt.status!==1)throw Error('Mint non confermato dal contratto');
   for(const id of ids)if((await contract.totalSupply(id))!==1n)
     throw Error('Tx confermata, ma supply inesperata per ID '+id+' — verificare manualmente');
   msg('CONFERMATO: '+ids.length+' NFT aggiunti alla stessa collezione. Tx '+tx.hash);
  }catch(e){err(e);}finally{lock();}
 };
 window.ethereum?.on?.('accountsChanged',()=>{signer=null;contract=null;configurer=null;lock();msg('Wallet cambiato: riconnettere.')});
 window.ethereum?.on?.('chainChanged',()=>{signer=null;contract=null;configurer=null;lock();msg('Rete cambiata: riconnettere.')});
}
