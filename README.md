## Archiviazione NFT senza canoni

La nuova modalità Arweave permette un pagamento unico per immagini e metadata, senza R2. Mantiene intatti i 19 JSON storici e aggiunge pin ricorsivi Kubo per i vecchi contenuti IPFS: `npm run nft:ipfs:pin-originals -- --pin`. Il nodo deve restare accessibile per servire i vecchi URI. Nessuna pubblicazione reale è stata eseguita. [Procedura completa](docs/ARWEAVE-SENZA-ABBONAMENTO.md).

# Risuonatore Solare — archivio NFT

**Ottimizzazione mint (22/10/2026):** individuato `multiConfigure` del configuratore OpenSea ERC-1155, che può impostare le supply e mintare i nuovi NFT con **una transazione per lotto**. [Console e test locali aggiornati](docs/OPERATORE-LOCALE.md). Questo nuovo percorso non è ancora stato validato tramite un fork locale; nessun mint reale è stato effettuato e nessun GitHub Actions sarà utilizzato.

> **Operatività locale:** tutti gli otto workflow GitHub Actions introdotti durante questo sviluppo sono stati rimossi. Preparazione NFT, test e console MetaMask si eseguono su Windows, senza CI. [Guida](docs/OPERATORE-LOCALE.md).

Collezione artistica **Risuonatore Solare**. Il catalogo di riferimento è [`nft-colors.html`](nft-colors.html); il dominio dichiarato in `CNAME` è **nft.mirkolancerotto.it**.

> **Aggiornamento 21 ottobre 2026.** Il repository contiene **108 schede colore × 22 profondità = 2.376 PNG**. Collezione [OpenSea](https://opensea.io/collection/solar-resonator-quantum-nft-collection) identificata: **Polygon ERC-1155**, contratto `0xead98e12d3836562ea39c6a6ca5ef1292359a862`, **19 token ID** pubblici corrispondenti a **18 combinazioni**. 2.358 altre combinazioni non risultano in questi item e restano **da verificare on-chain**. Vedi [riconciliazione OpenSea](docs/OPENSEA-COLLEZIONE-VERIFICATA.md).

## Struttura

| Percorso | Funzione |
| --- | --- |
| `nft-colors.html` | **Pagina principale**: catalogo, selezione colore/profondità, significati |
| `assets/js/main.js` | Caricamento JSON, rendering, filtri e selezione NFT |
| `assets/json/nft-colors.json` | 108 colori: ID, nome, HEX, categoria, significato |
| `assets/json/leveles-description.json` | 22 profondità con testi simbolici; campo IT/EN |
| `nft-imgs/` | 2.376 PNG, 2.222 × 2.222 px nominali; naming deterministico |
| `risuonatore-nft.html` | Strumento storico di generazione/download immagini via canvas |
| `heart-nft.html` + `assets/js/main-heart.js` | Esperimento complementare «Heart» su SVG |
| `python/gen-csv.py` | Esporta i dati editoriali JSON in CSV |
| `tarocchi-marsigliesi/` | Immagini usate per l'interpretazione delle 22 profondità |
| `docs/` | Documentazione tecnica, audit, inventario e pubblicazione futura |

## Avvio in locale

Servono Node.js e npm. Eseguire dalla root del repository:

```sh
npm ci
npm start
```

Aprire `http://localhost:8080/nft-colors.html`. Le fetch e le URL assolute `/assets/...` richiedono un server HTTP; aprire il file in modalità `file://` non è equivalente.

Per rigenerare i CSV, dalla cartella `python/` eseguire `python gen-csv.py` (richiede Python 3).

## Documentazione

1. [Architettura e flussi dati](docs/ARCHITETTURA.md)
2. [Modello artistico, ID e metadati](docs/CATALOGO-E-METADATI.md)
3. [Audit del repository — problemi e rischi](docs/AUDIT-2026-10-21.md)
4. [Mint esistenti e registro verificato](docs/REGISTRO-MINT.md)
5. [Automazione OpenSea: opzioni e flusso](docs/OPENSEA-AUTOMAZIONE.md)
6. [Roadmap incrementale](docs/ROADMAP.md)
7. [Collezione OpenSea e 19 token identificati](docs/OPENSEA-COLLEZIONE-VERIFICATA.md)
8. [Audit del contratto Polygon ERC-1155: metodo e comandi](docs/AUDIT-CONTRATTO-POLYGON.md)
9. [Snapshot on-chain verificato (Polygon, ABI e supply)](data/onchain/polygon-contract-2026-10-21.json)
10. [Mint programmabile nella stessa collezione: prova e procedura IPFS](docs/PROGRAMMATIC-MINT-SAME-COLLECTION.md)

**Non è stata avviata alcuna operazione on-chain.** Prima di generare token, cambiare metadati pubblicati o caricare file su OpenSea, eseguire la riconciliazione dei mint esistenti descritta nelle guide. Le 108 schede non corrispondono a 108 HEX diversi: vedere [audit](docs/AUDIT-2026-10-21.md).

## Diagnostica del contratto su Polygon (solo lettura)

Il repository include ora un comando Node.js, senza nuove dipendenze, per verificare **dal proprio computer** rete, bytecode, standard ERC-1155, URI metadata e ABI verificata. Non collega wallet e non invia transazioni.

```sh
npm run nft:chain:test
npm run nft:chain:audit -- --out reports/polygon-audit.json
```

Per una scansione di eventi in una finestra **specifica e documentata**: `npm run nft:chain:audit -- --from-block N --to-block M --out reports/polygon-events.json`. Le scansioni coprono al massimo 100.000 blocchi per esecuzione: vanno concatenate senza intervalli scoperti dal blocco di deploy. Vedere [guida tecnica](docs/AUDIT-CONTRATTO-POLYGON.md). **Non eseguire mint basandosi solo sul risultato di queste chiamate.**


## La stessa collezione: mint programmabile dimostrato su fork

**21 ottobre 2026:** il fallback dell'implementazione verificata permette `multiConfigureMint(address,uint256[],uint256[])` con firma dell'owner o del configurer autorizzato. Su fork locale Anvil della **collezione originale** sono state eseguite con successo `setMaxSupply(20,1)` e `multiConfigureMint(owner,[20],[1])`, facendo passare `totalSupply(20)` da 0 a 1 **solo sul fork**. [Prova completa](docs/PROGRAMMATIC-MINT-SAME-COLLECTION.md) (eseguita storicamente, senza ulteriori GitHub Actions).

Sono disponibili gli script `scripts/plan-next-mints.mjs` per il manifest **2.358 NFT da pianificare** e `scripts/stage-ipfs-release.mjs` per preparare una directory IPFS che conservi esattamente i metadata dei 19 NFT storici. Lo staging su Kubo richiede azione locale esplicita (`--stage`); nessun mint né `setBaseURI` sono stati effettuati su Polygon reale.

Comandi senza effetti esterni:

```sh
node scripts/plan-next-mints.mjs
node scripts/stage-ipfs-release.mjs
```

Il pinning IPFS vero è documentato in [procedura stessa collezione](docs/PROGRAMMATIC-MINT-SAME-COLLECTION.md); richiede il recupero dei metadati storici e non equivale a mint on-chain.

## Recupero IPFS storico e verifica locale (ottobre 2026)

Il collo di bottiglia non è più il numero di transazioni ma la **salvaguardia dei metadata IPFS dei 19 NFT storici**. Per usarli nella nuova directory, devono essere recuperati esattamente dal CID originario. I gateway `ipfs.io` e `dweb.link` non sono più adatti all'uso automatico e sono stati sostituiti da gateway Pinata/Storacha per la diagnosi e il controllo esterno (non equivalgono a due pinning service indipendenti).

```powershell
npm install
npm run nft:plan
npm run nft:doctor
npm run nft:ipfs:diagnose
# Dopo aver installato IPFS Kubo e avviato il daemon:
npm run nft:ipfs:recover
npm run nft:historic:images
npm run nft:historic:images:verify
```

Solo dopo aver recuperato tutti i 19 JSON:
```powershell
node scripts/stage-ipfs-release.mjs --stage
npm run nft:ipfs:verify
npm run nft:ipfs:public
npm run nft:ids:audit
```

**Questi comandi non mintano NFT e non aggiornano la blockchain.** L'archivio finale richiede pinning remoto ridondante e approvazione separata dell'eventuale cambio `baseURI`. Il nuovo metodo batch del configuratore richiede ancora validazione Anvil. [Guida Windows aggiornata](docs/OPERATORE-LOCALE.md).

## Console locale NFT — senza GitHub Actions

```powershell
npm install
npm run nft:local:test
npm run nft:plan
npm run nft:mint:plan -- --batch-size 10 --start 0 --count 20
# Richiede Anvil fork in ascolto su 127.0.0.1:8545:
npm run nft:fork:atomic
npm run nft:console
```

Aprire http://127.0.0.1:8765/ con MetaMask. Ogni operazione on-chain è bloccata finché l'archivio IPFS dei 19 NFT storici e dei nuovi non è verificato e la base URI non coincide. [Procedura completa](docs/OPERATORE-LOCALE.md).

### Ripresa e prova obbligatoria prima delle firme

Dopo aver mintato e riconciliato un primo gruppo, è possibile preparare il successivo **senza transazioni automatiche**:

```powershell
npm run nft:ids:audit
npm run nft:mint:resume -- --batch-size 10 --count 100
```

Il sistema rifiuta lacune, supply parziali e ID già occupati dal lotto selezionato. Prima di qualsiasi richiesta di firma reale serve inoltre il report generato da `npm run nft:fork:atomic` su Anvil locale; la console verifica il checksum dell'ABI, il gas e la conservazione della base URI originale. [Guida completa](docs/OPERATORE-LOCALE.md).

### Backup integrale degli NFT storici

Per proteggere i primi 19 NFT, oltre ai metadata JSON ora viene richiesto anche il backup **byte-per-byte delle immagini originali** tramite Kubo e la successiva verifica locale SHA256. I relativi URI vengono mantenuti invariati. Se un'immagine storica punta soltanto a un server HTTPS modificabile (senza CID IPFS), il controllo si interrompe anziché certificare un backup non dimostrabile. La console MetaMask non può autorizzare il mint senza questa prova. [Guida operativa](docs/OPERATORE-LOCALE.md).
