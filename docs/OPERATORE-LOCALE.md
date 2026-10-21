# Operatore NFT locale — stessa collezione OpenSea

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
