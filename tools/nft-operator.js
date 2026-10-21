'use strict';
/* Works only from 127.0.0.1. Wallet signing is EXPLICIT, one tx at a time. */
(async()=>{
 const CONTRACT='0xead98e12d3836562ea39c6a6ca5ef1292359a862';
 const ABI=[
  'function owner() view returns(address)',
  'function baseURI() view returns(string)',
  'function totalSupply(uint256) view returns(uint256)',
  'function totalMinted(uint256) view returns(uint256)',
  'function maxSupply(uint256) view returns(uint256)',
  'function setMaxSupply(uint256,uint256)',
  'function multiConfigureMint(address,uint256[],uint256[])'
 ];
 const $=id=>document.getElementById(id);
 const log=t=>{$('log').textContent=new Date().toLocaleTimeString()+' · '+t+'\n\n'+$('log').textContent.slice(0,5500)};
 const showErr=e=>log('Errore: '+(e?.shortMessage||e?.message||String(e)));
 if(location.hostname!=='127.0.0.1'){document.body.textContent='Console disponibile esclusivamente su 127.0.0.1';return}
 let state=null,provider=null,signer=null,contract=null;
 try{
   const response=await fetch('/plan',{cache:'no-store'});
   if(!response.ok)throw Error('Piano non disponibile (HTTP '+response.status+')');
   state=await response.json();
   const {plan}=state;
   const batches=plan.operations.filter(o=>o.kind==='mint_batch');
   const controls=plan.operations.filter(o=>o.kind==='configure_supply');
   $('planStatus').textContent=
     plan.totals.selected+' token pianificati · '+controls.length+
     ' configurazioni · '+batches.length+' lotti mint. '+
     (state.tx_gates_satisfied_for_ui?'Backup IPFS locale verificato.':'PUBBLICAZIONE BLOCCATA: IPFS o report non verificati.');
   $('planStatus').className=state.tx_gates_satisfied_for_ui?'good':'danger';
   $('batchInfo').textContent='Lotti disponibili: '+batches.length+'.';
 }catch(e){showErr(e);$('planStatus').textContent='Piano assente. Segui le istruzioni docs.';return;}
 const ownerAddress='0x2180747f94c3319162137a0e2ca5b1e8c7efb2ed';
 async function preflight(requireUri=true){
   if(!provider||!signer)throw Error('Connettere prima il wallet');
   const net=await provider.getNetwork();
   if(net.chainId!==137n)throw Error('Selezionare Polygon mainnet (chain ID 137)');
   const connected=await signer.getAddress();
   const onchainOwner=await contract.owner();
   if(onchainOwner.toLowerCase()!==ownerAddress)throw Error('Proprietario on-chain cambiato: stop');
   if(connected.toLowerCase()!==onchainOwner.toLowerCase())
     throw Error('Wallet connesso diverso da owner(). Nessuna firma possibile.');
   const code=await provider.getCode(CONTRACT);
   if(code==='0x')throw Error('Contratto non presente');
   const uri=await contract.baseURI();
   $('walletStatus').textContent='Wallet: '+connected+'\nContratto: '+CONTRACT+
     '\nBase URI attuale: '+uri+
     '\nBase URI nuovo progetto: '+(state.plan.proposed_base_uri||'(non verificato)');
   if(requireUri){
     if(!state.tx_gates_satisfied_for_ui)throw Error('Non esiste una release IPFS locale integralmente verificata');
     if(uri!==state.plan.proposed_base_uri)
       throw Error('La base URI on-chain non corrisponde al release preparato. Non configurare/mintare.');
   }
   return connected;
 }
 function selectedBatch(){
   const i=Number($('batchIndex').value);
   const batches=state.plan.operations.filter(o=>o.kind==='mint_batch');
   if(!Number.isInteger(i)||i<1||i>batches.length)throw Error('Numero di lotto non valido');
   return batches[i-1];
 }
 async function gasPrompt(action,estimate){
   const fee=await provider.getFeeData();
   const unit=fee.maxFeePerGas??fee.gasPrice;
   if(!unit)throw Error('Impossibile stimare il prezzo gas');
   const cost=ethers.formatEther(estimate*unit);
   return confirm(action+'\n\nGas stimato: '+estimate+
    '\nCosto massimo indicativo: '+cost+' POL (non garantito)'+
    '\n\nContinuare alla firma nel wallet?');
 }
 async function checkToken(id){
   return {
    id:String(id),
    maxSupply:await contract.maxSupply(id),
    minted:await contract.totalMinted(id),
    supply:await contract.totalSupply(id)
   };
 }
 $('connect').onclick=async()=>{
   try{
     if(!window.ethereum||!window.ethers)throw Error('MetaMask e dipendenze locali non trovati');
     provider=new ethers.BrowserProvider(window.ethereum);
     await provider.send('eth_requestAccounts',[]);
     signer=await provider.getSigner();
     contract=new ethers.Contract(CONTRACT,ABI,signer);
     const addr=await preflight(false);
     log('Wallet connesso (sola lettura). '+addr);
     $('configure').disabled=!state.tx_gates_satisfied_for_ui;
     $('mint').disabled=!state.tx_gates_satisfied_for_ui;
   }catch(e){showErr(e);}
 };
 $('check').onclick=async()=>{try{await preflight(false);log('Owner, contratto e Polygon controllati.');}catch(e){showErr(e)}};
 $('configure').onclick=async()=>{
   try{
     await preflight();
     const id=$('tokenId').value.trim();
     const op=state.plan.operations.find(o=>o.kind==='configure_supply' && o.token_ids[0]===id);
     if(!op)throw Error('ID fuori dal piano locale');
     const current=await checkToken(BigInt(id));
     if(current.minted!==0n||current.supply!==0n)throw Error('ID già mintato in passato; rifiutato');
     if(current.maxSupply===1n){log('ID '+id+' già configurato, niente da firmare.');return}
     if(current.maxSupply!==0n)throw Error('maxSupply inaspettata: '+current.maxSupply);
     const gas=await contract.setMaxSupply.estimateGas(id,1n);
     if(!(await gasPrompt('Configurare maxSupply=1 per token '+id+'?',gas)))return;
     const tx=await contract.setMaxSupply(id,1n);
     log('Transazione inviata: '+tx.hash);
     const receipt=await tx.wait(1);
     if(receipt.status!==1)throw Error('Configurazione fallita');
     if((await contract.maxSupply(id))!==1n)throw Error('Configurazione non verificata');
     log('OK: token '+id+' configurato. '+tx.hash);
   }catch(e){showErr(e);}
 };
 $('mint').onclick=async()=>{
   try{
     const wallet=await preflight();
     const batch=selectedBatch();
     const recipient=state.plan.recipient??wallet;
     const ids=batch.token_ids;
     for(const id of ids){
       const t=await checkToken(BigInt(id));
       if(t.minted!==0n||t.supply!==0n||t.maxSupply!==1n)
         throw Error('Lotto bloccato: ID '+id+' max='+t.maxSupply+' minted='+t.minted+' supply='+t.supply);
     }
     const amounts=ids.map(()=>1n);
     const gas=await contract.multiConfigureMint.estimateGas(recipient,ids,amounts);
     if(!(await gasPrompt('Mint di '+ids.length+' token verso '+recipient+'?',gas)))return;
     const tx=await contract.multiConfigureMint(recipient,ids,amounts);
     log('Mint inviato: '+tx.hash);
     const receipt=await tx.wait(1);
     if(receipt.status!==1)throw Error('Mint non riuscito');
     for(const id of ids)if((await contract.totalSupply(id))!==1n)
       throw Error('Ricevuta OK ma supply errata per '+id);
     log('Mint confermato: '+ids.length+' NFT. Tx '+tx.hash);
   }catch(e){showErr(e)}
 };
 window.ethereum?.on?.('accountsChanged',()=>{signer=null;contract=null;$('configure').disabled=true;$('mint').disabled=true;log('Wallet cambiato: riconnettere.')});
 window.ethereum?.on?.('chainChanged',()=>{signer=null;contract=null;$('configure').disabled=true;$('mint').disabled=true;log('Rete cambiata: riconnettere.')});
})();
