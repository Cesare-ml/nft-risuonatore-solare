# Operatore NFT locale — collezione OpenSea originale

**Percorso alternativo senza canoni:** il progetto ora include la pipeline Arweave a pagamento unico, senza R2, e il self-pinning IPFS dei vecchi file. Leggi [ARWEAVE-SENZA-ABBONAMENTO.md](ARWEAVE-SENZA-ABBONAMENTO.md) prima di utilizzare i comandi del precedente percorso IPFS. Le autorizzazioni reali sulla blockchain restano separate.

**Stato al 22 ottobre 2026.** Tutti i workflow GitHub Actions aggiunti sono stati rimossi. **Nessuna transazione Polygon mainnet è stata inviata.** Il nuovo mint atomico tramite configuratore OpenSea non ha ancora superato una prova Anvil eseguita sul PC. Il CID IPFS storico dei 19 NFT già esistenti non è stato ancora recuperato integralmente.

## Obiettivo, ID e contratto

- Collezione Polygon ERC-1155 originale: `0xead98e12d3836562ea39c6a6ca5ef1292359a862`.
- Configuratore OpenSea esistente: `0x864baa13e01d8f9e26549dc91b458cd15e34eb7c`.
- 19 token storici con ID 1–19, corrispondenti a 18 combinazioni artistiche distinte.
- 2.358 opere ancora da rappresentare. Nuovi ID **proposti** 20–2377; non sono garantiti liberi finché non è stato effettuato l’audit su Polygon.
- Il metodo verificato `multiConfigure(address,tuple)` del configuratore (selector `0xa64dfa75`) può **configurare maxSupply e mintare nella stessa transazione**. Batch proposti da 10 token: 236 firme; da 30 token: 79. Sono stime del numero di operazioni, **non dei costi o del gas reale**.

Riferimento contratto: [sorgente verificato ERC1155SeaDropConfigurer](https://www.codeslaw.app/contracts/ethereum/0x864baa13e01d8f9e26549dc91b458cd15e34eb7c). La console usa una singola firma in MetaMask per lotto. Non richiede seed phrase o chiavi private.

## 1. Preparazione su Windows

Aprire PowerShell nella cartella del progetto dopo aver aggiornato il clone Git:

```powershell
npm install
npm run nft:local:test
npm run nft:plan
npm run nft:doctor
```

Il doctor mostra componenti installati, artefatti presenti e verifiche mancanti; **non autorizza mai le firme**. I file temporanei sono in `reports/`, ignorati da Git.

## 2. Recupero dei 19 metadati storici — blocco principale

Il CID originale è `bafybeih7ucalsv5p2xh3zjrslg6fjgz7y3t4q2fivebci56mz3wex4gwj4` con nomi `{id}` esadecimali a 64 caratteri, in minuscolo. Ogni vecchio JSON deve essere conservato **byte per byte** per non alterare l'esperienza dei collezionisti.

Installa [IPFS Kubo](https://docs.ipfs.tech/install/command-line/) e avvia il suo daemon. Per una prima diagnosi **senza Kubo**:

```powershell
npm run nft:ipfs:diagnose
```

Il comando prova il solo token #1 via gateway Pinata e Storacha: non salva o certifica metadati. Per il recupero affidabile, da Kubo:

```powershell
npm run nft:ipfs:recover
```

### Preservare anche le immagini dei 19 NFT esistenti

Dopo il recupero dei 19 JSON storici, esegui:

```powershell
npm run nft:historic:images
npm run nft:historic:images:verify
```

Il primo comando legge gli URI `image` dai JSON **originali** e recupera direttamente con Kubo i 19 file corrispondenti, salvandone i byte sotto `reports/solar-release-staging/historic-originals/images/`. Produce un report con SHA256, URI originale e CID verificato per ciascuna immagine. Il secondo comando controlla di nuovo **offline**, senza contattare alcuna rete, che tutti i byte locali corrispondano al report e all'archivio dei JSON.

Gli URI delle immagini non vengono modificati. I link HTTP centralizzati, senza un CID IPFS, **non sono accettati come prova di conservazione**: in questi casi serve recuperare la fonte autentica e verificarla separatamente, senza ricostruire arbitrariamente le opere dai thumbnail. Un nodo Kubo e il possesso locale dei file non garantiscono la loro disponibilità per sempre; serve comunque pinning remoto duraturo.

**Questa verifica è ora un requisito della console**, come il backup dei 19 JSON, prima che sia possibile autorizzare una firma su Polygon.

Il comando esegue `ipfs cat` dei 19 percorsi originali, li salva sotto `reports/solar-release-staging/historic-originals/`, rilegge via Kubo gli eventuali file già salvati e confronta SHA256. Produce `manifest.json` solo quando **tutti e 19** risultano recuperati. Il recupero interrotto può essere ripreso. **Se Kubo non trova i file, non ricrearli manualmente dalle anteprime OpenSea e non modificare baseURI.**

Dal 2026 i gateway `ipfs.io` e `dweb.link` hanno cessato di essere una sorgente affidabile per client automatici: erano anche due nomi della stessa infrastruttura. [Annuncio IPFS, agosto 2026](https://discuss.ipfs.tech/t/changes-to-ipfs-io-and-dweb-link-gateways/20328). Recuperare con Kubo evita di dipendere dai due hostname.

## 3. Staging della nuova directory IPFS

Solo dopo il recupero storico:

```powershell
npm run nft:ipfs:check
node scripts/stage-ipfs-release.mjs --stage
npm run nft:ipfs:verify
```

Lo staging crea 2.358 nuove immagini IPFS, 2.358 JSON nuovi e riutilizza i 19 JSON originali. Crea un **nuovo CID della directory completa con 2.377 metadati**. Per ogni PNG già presente nello staging confronta ora **SHA256**, non soltanto la dimensione. Il verificatore locale confronta anche ogni PNG con il suo file sorgente nel repository.

**Non è sufficiente un solo pin locale.** Serve pinning remoto ridondante e verifica duratura delle immagini e dei 19 metadata storici.

Verifica indipendente della raggiungibilità su due **operatori gateway differenti**:

```powershell
npm run nft:ipfs:public
```

I default sono `gateway.pinata.cloud` e `w3s.link`; puoi sovrascriverli con due `--gateway https://host/ipfs` diversi. Confronta tutti e 19 i JSON originali su entrambi, più 5 metadata e 5 immagini nuovi: **58 verifiche remote**. Il programma rifiuta gateway dismessi e alias di uno stesso operatore noto. Gateway di operatori distinti **non dimostrano** che i dati siano conservati da due pinning service indipendenti.

## 4. Scansione Polygon degli ID

```powershell
npm run nft:ids:audit
```

Il programma usa Multicall3 su Polygon per controllare al medesimo blocco i 2.358 ID proposti più i 19 storici. Legge `maxSupply`, `totalMinted` e `totalSupply` senza wallet o transazioni. Produce `reports/onchain-new-ids-audit.json` e blocca il piano se trova un ID già utilizzato. La console accetta l'audit solo per **12 ore**, e controlla nuovamente gli ID del lotto prima di ogni firma.

## 4 bis. Riprendere dopo un primo gruppo di NFT mintati

Per non perdere il punto raggiunto, il catalogo ora ha anche un **piano di ripresa**. Dopo il primo lotto, ripeti la scansione blockchain e genera automaticamente il prossimo gruppo di ID ancora liberi:

```powershell
npm run nft:ids:audit
npm run nft:mint:resume -- --batch-size 10 --count 100
```

Il comando legge tutti i 2.358 ID dal report Polygon più recente (massimo 12 ore), riconosce solo una **sequenza iniziale** di ID con `maxSupply=1`, `totalMinted=1` e `totalSupply=1`, e prepara i prossimi 100 ID ancora liberi in 10 lotti da 10. Il file `reports/local-mint-batches.json` viene aggiornato solo localmente, senza alcuna firma. Puoi ridurre `--count` per lavorare su pochi NFT alla volta.

La presenza di supply 1 **non dimostra chi ha ricevuto l'NFT**: prima di considerare conclusi i lotti precedenti, confronta le transazioni che hai firmato e i relativi destinatari. Se il rapporto mostra un token configurato a metà, token non consecutivi oppure stati sconosciuti, la ripresa si blocca; non bisogna correggere manualmente gli ID senza un nuovo audit.

Con il nuovo sistema la **scansione completa resta obbligatoria** ogni volta; soltanto gli ID del piano attuale devono essere liberi, mentre i token precedentemente completati non vengono proposti per un secondo mint. La console ricontrolla tutto prima della firma. Il test Anvil del percorso atomico resta un prerequisito ancora da completare.

### Nuovo controllo: autenticità del fork Anvil

La prova non accetta più un semplice nodo Anvil con `--chain-id 137`: richiede `anvil_nodeInfo.forkConfig` con un blocco Polygon non anteriore al nostro audit storico e il **bytecode EIP-1167 originale** della collezione, che punta all'implementazione `0x9f36ee33fd56c7d9a78facd3249c580b1ca464a2`. Il report locale salva queste informazioni. Un fork di un contratto differente non abilita la firma.

Alla firma reale, la console confronta **di nuovo** il bytecode del proxy con il riferimento storico e il **codehash del configuratore** live con quello del report Anvil; controlla la rete, il wallet owner, il CID on-chain e tutti gli ID, **anche dopo la conferma del preventivo di gas**, subito prima della richiesta a MetaMask.

Questa prova non stabilisce che il wallet sia effettivamente sotto il controllo dell'artista, né che IPFS sia conservato nel tempo. Il test Anvil atomico rimane ancora da eseguire sul PC.

## 5. Piano dei lotti, prova su Anvil e console

```powershell
npm run nft:mint:plan -- --batch-size 10 --release-report reports/solar-release-staging/release-report.json
```

La prova Anvil è ora **obbligatoria**: la console richiede il report `reports/atomic-fork-proof.json`, recente e con checksum dell'ABI attuale, prima di permettere qualsiasi richiesta di firma. Il test deve dimostrare tre transazioni di mint atomico (lotti 1, 5, 10), base URI invariata, token #1 storico invariato e nessuna modifica alla Polygon reale.

**Test necessario ancora da eseguire:** installare Foundry e avviare un fork locale isolato, su un primo terminale:

```powershell
anvil --fork-url https://polygon.drpc.org --chain-id 137 --host 127.0.0.1 --port 8545
```

Su un secondo terminale:

```powershell
npm run nft:fork:atomic
```

Il test produce `reports/atomic-fork-proof.json` **solo se tutti i lotti hanno ricevute riuscite e i controlli storici restano invariati**. La console rifiuta report mancanti, scaduti oltre sette giorni o riferiti a una versione diversa del codice ABI.

Questo test impersona l'owner **solo nel fork** e prova 1, 5 e 10 token per transazione, misurando il gas. Non pubblica NFT reali. Il precedente test riuscito su fork utilizzava due chiamate **separate**: non va confuso con questo nuovo test.

Console **in sola lettura**, accessibile solo dal PC:

```powershell
npm run nft:console
```

Apri `http://127.0.0.1:8765/` con MetaMask. Per richiedere firme **soltanto dopo la verifica del nuovo CID, l'aggiornamento separatamente autorizzato della baseURI on-chain e la prova Anvil**, avviare invece:

```powershell
$env:NFT_ENABLE_SIGNING="YES-I-REVIEWED-THE-RELEASE"
npm run nft:console
```

L'opt-in non firma automaticamente: permette soltanto di abilitare il pulsante quando TUTTI i controlli sono superati. **Ogni lotto richiede una conferma separata in MetaMask**. Se il wallet connesso non coincide con `owner()` del contratto Polygon reale, nessun mint viene consentito.

### Verifiche richieste in console

- Piano atomico con ID e operazioni esattamente corrispondenti.
- Directory locale completa, integrità SHA256 dei 19 JSON e **copia verificata di tutte le 19 immagini storiche**.
- Report IPFS pubblico su due operatori gateway, non più vecchio di 24 ore.
- Audit completo 2.358 ID su Polygon, non più vecchio di 12 ore.
- Nuovo CID della release identico alla `baseURI()` già attiva on-chain.
- Rete Polygon (137), contratto e configuratore originali, wallet con ruolo owner, opt-in locale.
- Nuova lettura in tempo reale di tutti gli ID del lotto prima della richiesta di firma.

## Avvertenza sulla baseURI

Il nuovo CID non può essere attivato dal semplice staging. **Nessuno script del repository invia `setBaseURI`.** È un'operazione separata, che modificherebbe il riferimento dei metadata anche per i token storici già acquistati. Prima di autorizzarla occorrono tutti i JSON originali, verifica di pinning remoto indipendente e valutazione dell'impatto sui collezionisti. Non procedere sulla mainnet finché non sono completi.

## Codice e test

- `scripts/recover-historic-ipfs.mjs` — recupero byte originali via Kubo.
- `scripts/verify-historic-ipfs-media.mjs` — recupero e confronto SHA256 delle immagini storiche.
- `scripts/stage-ipfs-release.mjs` e `scripts/verify-ipfs-release.mjs` — staging e verifica locale.
- `scripts/verify-public-ipfs-release.mjs` e `scripts/lib/ipfs-gateways.mjs` — gateway e controlli SHA256.
- `scripts/audit-new-token-ids.mjs` — audit completo Polygon Multicall3.
- `scripts/prepare-mint-batches.mjs` e `scripts/lib/mint-plan.mjs` — pianificazione.
- `scripts/fork-configurer-atomic-proof.mjs` — prova Anvil **ancora da eseguire**.
- `scripts/local-mint-console.mjs`, `tools/nft-operator.js` e `scripts/lib/publish-readiness.mjs` — console protetta.
- `tests/` — test locali Node eseguibili con `npm run nft:local:test`.

**Tutto locale, nessun GitHub Actions.**
