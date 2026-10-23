# Risuonatore Solare — Arweave senza abbonamento
**Aggiornamento 23/10/2026.** Scelta consigliata: **Arweave con pagamento una tantum**, senza Cloudflare R2 e senza abbonamento a Pinata/Filebase. Zero GitHub Actions. **Nessuna spesa automatica e nessun mint on-chain effettuato da questi preparatori.**

## Architettura verificabile

1. Gli **originali 19 token ERC-1155** sono salvati con JSON identici byte-per-byte al CID IPFS storico \`bafybeih7ucalsv5p2xh3zjrslg6fjgz7y3t4q2fivebci56mz3wex4gwj4\`. Anche le 19 immagini originali vengono salvate tramite Kubo, SHA256 confrontato, *senza modificare gli URI image nel JSON storico*.
2. Le **2.358 nuove immagini** (e i 19 backup delle immagini storiche) sono caricate **una sola volta** su Arweave tramite ArDrive Turbo. File con **identico SHA256** sono caricati una volta sola. Ogni ricevuta è registrata localmente in \`reports/arweave-one-time/receipts-media.json\`. L'upload è manuale e non avviene senza flag espliciti.
3. I nuovi JSON usano \`"image": "ar://<imageTransactionId>"\`, supportato da OpenSea. I 19 vecchi JSON restano IDENTICI all'originale, quindi le loro immagini fanno ancora riferimento a IPFS.
4. I 2.377 JSON sono caricati **uno a uno, con ricevute e tetto USD per sessione**, poi associati mediante un **Arweave path manifest v0.2.0** con path esattamente pari al token ID esadecimale minuscolo a 64 cifre.
5. La futura baseURI sarebbe \`https://arweave.net/<manifest_id>/{id}\`, ma **nessuna modifica del contratto è automatizzata**: cambiare baseURI riguarda anche i 19 token posseduti da collezionisti.
6. La console mantiene tutti i blocchi attuali (owner Polygon, audit completo degli ID, IPFS storico, test Anvil del mint atomico, checksum e codehash dei contratti). Per Arweave richiede **verifica remota completa su due gateway** e un **secondo test Anvil** specifico per la baseURI del manifest reale.

**Punto fondamentale:** il backup Arweave delle 19 immagini storiche **non mantiene da solo raggiungibili i vecchi URI IPFS**. Non si può garantire piena autonomia da server o nodi finché quegli URI IPFS esistono. Possiamo mantenere Kubo sul proprio computer/nodo (senza canone di un provider, ma non a costo operativo assoluto zero) e promuovere pinning di terze parti; oppure, *solo con consenso esplicito dei collezionisti e una decisione editoriale*, studiare una futura migrazione dei loro JSON alle copie permanenti delle immagini. Questa seconda via NON fa parte del codice automatico: cambierebbe i byte dei metadata già pubblicati.

## Prezzo: una volta, senza ricorrenze

Il costo Arweave dipende dai **byte realmente caricati** (circa 900 MB ipotizzati prima della misurazione e della deduplicazione) e dal prezzo in tempo reale, più piccole commissioni per i singoli elementi. ArDrive Turbo prevede anche top-up in valuta tradizionale tramite carta, e supporta POL, AR e altri token. Non c'è un piano mensile obbligatorio.

La documentazione Turbo riporta un *esempio*, **non il preventivo corrente**, di 20,58 USD per 1 GiB. Non acquistare crediti sulla base di questo valore. Lo script seguente interroga il costo attuale in **EUR e USD** e include una quota cautelativa di 16 MiB per i JSON/manifest.

\`\`\`powershell
npm install
npm install --no-save @ardrive/turbo-sdk
npm run nft:plan
npm run nft:arweave:quote
\`\`\`

Il preventivo iniziale senza backup può essere calcolato anche prima del recupero Kubo. Una volta completato l'inventario, la quotazione usa i **byte deduplicati reali**. Il preventivo non acquista nulla.

Documentazione ufficiale:
- https://docs.opensea.io/docs/metadata-storage
- https://docs.opensea.io/docs/metadata-standards
- https://docs.ar.io/build/upload/manifests
- https://docs.ar.io/build/upload/turbo-credits
- https://docs.ar.io/sdks/turbo-sdk
- https://console.ar.io/topup

## Procedura operativa locale

### 1. Tutelare i 19 NFT esistenti

Avviare il daemon IPFS Kubo in un terminale, poi nella cartella del repo:

\`\`\`powershell
npm run nft:plan
npm run nft:ipfs:recover
npm run nft:historic:images
npm run nft:historic:images:verify
npm run nft:ipfs:pin-originals
npm run nft:ipfs:pin-originals -- --pin
npm run nft:arweave:inventory
npm run nft:arweave:quote
\`\`\`

Se gli originali non sono raggiungibili in Kubo, **interrompere qui**. Non sostituirli con ricostruzioni da screenshot e non cambiare baseURI.

### 2. Caricare le immagini con un importo massimo esplicito

Creare un **wallet Arweave JWK separato dal wallet Polygon**, conservato **fuori dalla cartella GitHub**. Impostare soltanto il **percorso del file** in PowerShell (mai incollare il contenuto JWK in chat, codice, Git o log).

\`\`\`powershell
$env:ARWEAVE_JWK_PATH="C:\Keys\arweave-segreto.json"
npm run nft:arweave:upload -- --kind media
\`\`\`

Questo è un **dry-run gratuito**, non un upload. Per caricare volontariamente un primo file con tetto della stima della sessione di 2 USD:

\`\`\`powershell
npm run nft:arweave:upload -- --kind media --upload --accept-one-time-charge --max-usd 2 --limit 1
\`\`\`

Dopo aver verificato ricevuta e prezzo, ripetere con \`--limit 50\` o \`--limit 200\` e il tetto desiderato. **Non c'è nessuna autoricarica automatica**. Per i file già caricati il codice riutilizza le ricevute, senza spendere una seconda volta. Un crash tra upload riuscito e scrittura della ricevuta richiede una riconciliazione manuale per evitare costi duplicati.

### 3. Creare e caricare 2.377 metadata JSON

\`\`\`powershell
npm run nft:arweave:compose
npm run nft:arweave:upload -- --kind metadata
npm run nft:arweave:upload -- --kind metadata --upload --accept-one-time-charge --max-usd 2 --limit 50
\`\`\`

Ripetere l'ultimo comando fino al completamento dei 2.377 JSON. Per ciascuno l'upload associa esplicitamente il tag Content-Type \`application/json\` (i nomi esadecimali non hanno estensione).

### 4. Manifest ERC-1155 e verifica

\`\`\`powershell
npm run nft:arweave:manifest
npm run nft:arweave:manifest -- --upload --accept-one-time-charge --max-usd 1
npm run nft:arweave:local
npm run nft:arweave:verify
\`\`\`

L'ultima verifica, senza \`--full\`, controlla i 19 JSON storici, le relative 19 immagini e cinque coppie nuove su due gateway: è un controllo iniziale, **NON abilita firme**.

Per la prova completa:

\`\`\`powershell
npm run nft:arweave:verify -- --full
\`\`\`

Questa verifica legge su due gateway **tutti i 2.377 JSON e tutte le immagini uniche**. Può impiegare tempo e traffico internet notevole. Il sistema registra un attestato valido 24 ore soltanto se tutte le risposte combaciano con gli SHA256. Non equivale a una garanzia assoluta di accessibilità futura.

### 5. Testare il contratto originale (solo fork)

Su un primo terminale:

\`\`\`powershell
anvil --fork-url https://polygon.drpc.org --chain-id 137 --host 127.0.0.1 --port 8545
\`\`\`

Su un secondo terminale:

\`\`\`powershell
npm run nft:fork:atomic
npm run nft:fork:arweave
npm run nft:ids:audit
npm run nft:mint:plan -- --batch-size 10 --start 0 --count 10 --release-report reports/arweave-one-time/release-report.json
npm run nft:console
\`\`\`

La console resta **senza firme** finché non sono verificati tutti i prerequisiti e la nuova baseURI non è già stata attivata **separatamente** con l'approvazione dell'artista. NON abbiamo uno script che esegue tale variazione automaticamente.

Per continuare dopo il primo lotto:

\`\`\`powershell
npm run nft:ids:audit
npm run nft:mint:resume -- --batch-size 10 --count 100 --release-report reports/arweave-one-time/release-report.json
\`\`\`

## Cosa manca nella pratica oggi

- Il caricamento effettivo **non è stato avviato**: non sono stati spesi crediti Turbo.
- Il recupero storico Kubo dei 19 JSON e delle 19 immagini **non è ancora stato eseguito** sul computer dell'artista.
- Il nuovo percorso **non è stato provato con un fork Anvil attivo**: non sappiamo ancora se il configuratore e il contratto accetteranno tutti i percorsi.
- Il rapporto di prezzo in euro va richiesto **live**: non rivendichiamo una tariffa non verificata.
- Finché i vecchi 19 JSON puntano a IPFS, resta un'esigenza di disponibilità IPFS per quei contenuti, senza obbligo di un provider a canone ma senza garanzie assolute.

**Conclusione:** sviluppo preparatorio Arweave implementato senza R2, senza costi mensili obbligatori, con operazioni a pagamento solo su consenso esplicito. Nessuna transazione Polygon reale effettuata.

## Nodo Kubo senza canone

Il comando `npm run nft:ipfs:pin-originals` mostra tutti i CID storici da fissare. La variante `-- --pin` esegue un pin ricorsivo su Kubo per il CID degli originali e i CID delle 19 immagini e scrive un report locale. Non ci sono abbonamenti di archiviazione obbligatori. Per servire sempre i file, però, serve almeno un nodo Kubo con alimentazione, connessione e spazio disponibili; conserva anche un backup offline.

## Verifica semplice dello stato (23/10/2026)

Il primo comando ora è `npm run nft:arweave:status`: mostra quanti file mancano, eventuali upload sospesi, manifest e prove, e il prossimo comando sicuro. Funziona in sola lettura, senza wallet, senza pagamenti e senza transazioni. Per l'output JSON: `npm run nft:arweave:status -- --json`.

### Caricamenti interrotti senza doppia spesa

Ogni upload conserva prima della richiesta a Turbo uno stato `inflight` e un lock locale. Se l'esito della rete è ambiguo, i tentativi successivi si fermano: **non pagano un secondo caricamento in automatico**. Prima occorre individuare dalla cronologia di Turbo il vero ID dell'elemento e assicurarsi che l'eventuale processo precedente sia terminato.

```powershell
npm run nft:arweave:reconcile -- --kind media --id ID_ARWEAVE_REALE
# oppure per un metadata JSON:
npm run nft:arweave:reconcile -- --kind metadata --id ID_ARWEAVE_REALE
```

Il comando di riconciliazione **non carica e non paga nulla**: legge l'ID da due operatori gateway, confronta dimensione e SHA256 con il file originale, e solo dopo registra la ricevuta. Se il file `.lock` resta dopo un crash, non cancellarlo prima di aver verificato che l'altro processo non sia attivo. Un manifest già pubblicato è ora riconosciuto ed evita di ripagare un secondo upload.

### Preventivo completo e rete di accesso

Il preventivo `nft:arweave:quote` è una stima di archiviazione, **non l'importo effettivo del top-up**: Turbo prevede tariffa per byte, piccola commissione per data item e commissione sui crediti acquistati. Le eventuali soglie gratuite sono limitate nel tempo e nello spazio, non un abbonamento gratuito illimitato. Prima dell'acquisto consultare il preventivo corrente e la schermata delle commissioni: https://docs.ar.io/build/upload/turbo-credits .

I gateway Arweave possono reindirizzare a sottodomini sandbox: il verificatore li gestisce soltanto entro lo stesso operatore e rifiuta redirect verso domini estranei. Verifica i byte scaricati con un limite di dimensione e SHA256. Riferimento: https://docs.ar.io/build/access/fetch-data/ .

Resta valido il vincolo: **nessun R2, nessun canone mensile obbligatorio, nessun GitHub Actions, nessuna operazione Polygon senza autorizzazione separata**. Conservare gli URI IPFS dei vecchi NFT può richiedere un nodo con elettricità, connettività e backup.
