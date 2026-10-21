# Operatore NFT locale — stessa collezione OpenSea

## Aggiornamento: mint atomico in una transazione per lotto

Il contratto ufficiale **ERC1155SeaDropConfigurer** collegato alla stessa collezione Polygon (0x864baa13e01d8f9e26549dc91b458cd15e34eb7c) implementa **multiConfigure(address, MultiConfigureStruct)**, selector `0xa64dfa75`. Il sorgente verificato controlla `msg.sender == owner()` e usa sia `maxSupplyTokenIds` / `maxSupplyAmounts` sia `mintTokenIds` / `mintAmounts` nella **stessa transazione**. Non serve configurare una supply per transazione.

Fonti tecniche: [sorgente verificato ERC1155SeaDropConfigurer](https://www.codeslaw.app/contracts/ethereum/0x864baa13e01d8f9e26549dc91b458cd15e34eb7c) e [ABI verificata](https://etherscan.io/address/0x864baa13e01d8f9e26549dc91b458cd15e34eb7c#code). Il configuratore effettivamente associato alla collezione è stato letto on-chain dal precedente audit. Prima dell'operatività reale, il test del nuovo percorso va eseguito su **Anvil fork locale** della rete Polygon, non su Ethereum.

Il codice attuale:

- `scripts/lib/opensea-configurer.mjs`: ABI con **21 campi del tuple** esattamente nell'ordine del contratto verificato; costruttore che lascia intenzionalmente **vuoti** baseURI, contractURI, impostazioni vendite, allowlist e royalty.
- `scripts/lib/mint-plan.mjs`: produce ora `atomic_configure_mint`, una sola transazione per gruppo, anziché 1 configurazione per ID + mint successivo.
- `tools/nft-operator.js`: esegue `estimateGas` e quindi, **solo con il consenso esplicito in MetaMask**, una chiamata `multiConfigure` verso il configuratore storico.
- `scripts/fork-configurer-atomic-proof.mjs`: misura e verifica il comportamento di lotti da 1, 5 e 10 token soltanto su Anvil fork locale. **Non ancora eseguito in un ambiente Anvil per questa nuova versione**: il percorso diretto precedente era stato provato, ma questo resta da validare sul fork.

Numero teorico di transazioni **esclusa** la modifica della baseURI e gli eventuali pin IPFS:

| Nuovi NFT | Lotto | Operazioni atomiche proposte |
| ---: | ---: | ---: |
| 2.358 | 10 | 236 |
| 2.358 | 30 | 79 |

Questi numeri **non** sono stime dei costi: il limite gas del blocco e il prezzo per ogni lotto vanno verificati. Il test su fork non dimostra il possesso del wallet reale.

### Verifica sul PC senza GitHub Actions

```powershell
npm install
npm run nft:local:test
npm run nft:plan
npm run nft:mint:plan -- --batch-size 10 --start 0 --count 20
```

Per la prova del configuratore su un fork **isolato**, installare Foundry e in un primo terminale eseguire:

```powershell
anvil --fork-url https://polygon.drpc.org --chain-id 137 --host 127.0.0.1 --port 8545
```

Poi in un secondo terminale:

```powershell
npm run nft:fork:atomic
```

Il fork impersona localmente l'indirizzo pubblico owner **senza chiavi private** e usa snapshot/revert tra i lotti. Non può creare NFT nella Polygon reale. Se la simulazione non passa, **non avviare la console per firmare**.

### Ostacolo ancora aperto: IPFS storico

Il contratto conserva la URI dei 19 NFT nel CID attuale. La console richiede un nuovo CID metadata **verificato** che contenga i 19 JSON identici byte per byte oltre ai 2.358 nuovi. I gateway hanno dato errori HTTP 429: non abbiamo ancora recuperato e replicato gli originali. Una modifica `setBaseURI` cambierebbe il riferimento anche per gli NFT già detenuti da collezionisti. **Nessuna modifica è stata eseguita.**

---
**Nessun GitHub Actions.** I workflow di test introdotti in precedenza sono stati eliminati. Operazioni e prove si eseguono in locale su Windows, non su GitHub.

## Comandi PowerShell

```powershell
npm install
npm run nft:local:test
npm run nft:chain:test
npm run nft:plan
npm run nft:mint:plan -- --batch-size 10 --start 0 --count 20
npm run nft:console
```

Aprire http://127.0.0.1:8765/ con MetaMask installato. La console può collegarsi a Polygon e mostrare il piano; **blocca transazioni e mint finché il pacchetto IPFS non è verificato e non coincide con la base URI on-chain**.

## IPFS: preparazione separata

Serve IPFS Kubo installato con il comando `ipfs` disponibile nel terminale. La preparazione non è automatica.

```powershell
npm run nft:ipfs:check
node scripts/stage-ipfs-release.mjs --stage
npm run nft:ipfs:verify
npm run nft:mint:plan -- --batch-size 10 --release-report reports/solar-release-staging/release-report.json
npm run nft:console
```

Lo staging recupera e preserva *byte per byte* 19 JSON storici dall'IPFS CID esistente, prepara e pinna localmente i 2.358 PNG rimanenti e 2.358 nuovi JSON, e crea una directory di 2.377 metadata. Il verificatore legge i file locali e confronta SHA256. **Non conferma la disponibilità sui gateway pubblici o la ridondanza dei pin**.

I gateway pubblici interrogati in precedenza hanno restituito HTTP 429. Il recupero da Kubo dei 19 file originali non è ancora stato dimostrato: in caso di errore interrompere tutto, senza ricostruire arbitrariamente i JSON da titoli o preview di OpenSea. Il comando `--stage` pubblica su un nodo IPFS locale, ma non crea NFT e non invia transazioni.

## Proprietà, firma e operazioni

- Contratto: `0xead98e12d3836562ea39c6a6ca5ef1292359a862`, Polygon mainnet ID 137.
- Owner restituito dall'ultimo audit: `0x2180747f94c3319162137a0e2ca5b1e8c7efb2ed`. La console rifiuta firme se il wallet connesso è diverso dall'owner on-chain o se la rete non è Polygon.
- La console richiede una conferma separata in MetaMask per ogni transazione: nessuna seed phrase, private key o firma automatica.
- Prima di configurare un ID, verifica che maxSupply=0, totalMinted=0 e totalSupply=0. Prima di mintare un lotto, richiede maxSupply=1, totalMinted=0 e totalSupply=0 per ogni suo ID.
- Nessuno script cambia la baseURI automaticamente. **Cambiarla influisce anche sugli NFT già detenuti dai collezionisti**: approvazione distinta obbligatoria, dopo archiviazione storica e verifica dei pin remoti.
- Le immagini originali esistono nel repo, ma gli ID futuri 20–2377 sono ancora **proposti**: non è stata completata una scansione esaustiva on-chain di tutti gli ID futuri.

## Efficienza prima di procedere

Con la modalità diretta owner attualmente dimostrata, un catalogo di 2.358 token nuovi richiede **2.358 chiamate setMaxSupply individuali**, più circa **236 transazioni multiConfigureMint** da 10 token per lotto. Questo non è un preventivo né un motivo per eseguirle tutte: la prossima priorità è esaminare il **configuratore OpenSea** per cercare una configurazione raggruppata più efficiente e compatibile con il contratto storico.

Nel fork Anvil locale l'ID #20 è stato configurato e mintato correttamente; Polygon reale **non è stata modificata**. Gli script di planning e staging non effettuano firme, upload su OpenSea o azioni sulla blockchain.

## File

- `scripts/plan-next-mints.mjs`: piano artistico delle 2.358 combinazioni.
- `scripts/prepare-mint-batches.mjs`: bozza operazioni e lotti, senza firme.
- `scripts/stage-ipfs-release.mjs`: preservazione metadati storici e pinning locale Kubo, solo con --stage.
- `scripts/verify-ipfs-release.mjs`: verifica locale di 19 originali, nuovi JSON e PNG.
- `scripts/local-mint-console.mjs`: server localhost, nessuna chiave privata.
- `tools/nft-operator.html`, `tools/nft-operator.js`: interfaccia MetaMask locale.
- `tests/mint-plan.test.mjs`: test unitari Node da eseguire manualmente.

La documentazione contrattuale precedente è in [PROGRAMMATIC-MINT-SAME-COLLECTION.md](PROGRAMMATIC-MINT-SAME-COLLECTION.md).


## Ricerca del configuratore OpenSea (in sola lettura)

La configurazione di una supply separata per ognuno dei 2.358 token richiederebbe 2.358 firme/transazioni con il percorso diretto owner. Prima di avviare qualunque batch reale, verificare se il configurer OpenSea consente una gestione più efficiente:

```powershell
npm install
npm run nft:configurer:audit
```

Il comando interroga Polygon e Sourcify dal PC, controlla l'indirizzo del configuratore attualmente associato alla collezione e salva `reports/configurer-inspection.json`. **Non invia transazioni e non utilizza GitHub Actions.** Se l'ABI verificata non è disponibile, il risultato è inconcludente: è necessario recuperare il codice verificato da un explorer e simulare sul fork locale, non inventare il supporto batch.
