# Procedura di pubblicazione — stessa collezione ERC-1155

> **Aggiornamento:** strumenti di test e console MetaMask **locali** documentati in [Operatore locale](OPERATORE-LOCALE.md). Non utilizzare GitHub Actions; nessun mint reale o cambio baseURI effettuato.

Aggiornamento 21 ottobre 2026. **La strada on-chain è stata provata su un fork locale, senza inviare transazioni reali.**

## Risultato decisivo verificato

Il contratto di collezione `0xead98e12d3836562ea39c6a6ca5ef1292359a862` è un clone EIP-1167 che delega all'implementazione `0x9f36ee33fd56c7d9a78facd3249c580b1ca464a2`. Il codice sorgente verificato in Sourcify include `ERC1155SeaDropContractOffererCloneable.sol`.

Il suo `fallback` supporta `multiConfigureMint(address,uint256[],uint256[])` (selector **`0xae265953`**), protetto da `_onlyOwnerOrConfigurer()`; il `configurer()` on-chain è `0x864BaA13E01d8f9E26549dc91B458CD15E34EB7c`. Il contratto restituisce `owner()` = `0x2180747f94c3319162137a0e2ca5b1e8c7efb2ed`.

In una simulazione `eth_call` su mainnet il mint dell'ID 20 revertiva; il successivo controllo ha spiegato perché: **`maxSupply(20)=0`**, mentre `maxSupply(1)=1` e `maxSupply(19)=1`. Su un fork Anvil isolato è stato dimostrato:

1. `setMaxSupply(20,1)` chiamato dall'owner simulato: **success**, gas del fork 52.256.
2. `multiConfigureMint(owner,[20],[1])`: **success**, gas del fork 91.607.
3. `totalSupply(20)`: passa **da 0 a 1** sulla copia locale; Polygon mainnet **non modificata**.

Prova verificabile: [GitHub Actions fork proof](https://github.com/Cesare-ml/nft-risuonatore-solare/actions/runs/39677491570). Script [`fork-studio-mint-proof.mjs`](../scripts/fork-studio-mint-proof.mjs). Non richiede il wallet reale: Anvil impersona un indirizzo pubblico **solo sulla copia locale**. I gas misurati non sono preventivi economici garantiti.

**Conclusione tecnica:** è possibile mintare programmaticamente nel **contratto della collezione esistente** se il mittente ha i permessi richiesti e supply/metadata sono preparati. Non è necessario un nuovo contratto. Il controllo dell'indirizzo `owner()` da parte dell'artista non è ancora stato verificato con una firma.

## Catalogo e ID

Il comando [`plan-next-mints.mjs`](../scripts/plan-next-mints.mjs) genera **offline** `reports/staging-mint-plan.json`. Test GitHub Actions [riuscito](https://github.com/Cesare-ml/nft-risuonatore-solare/actions/runs/39677419007).

- Combinazioni di partenza: **2.376** (108 × 22).
- Token esistenti osservati: **19**; corrispondono a **18 combinazioni distinte** (ID #3 e #4 sono entrambi colore 80, livello 8).
- Combinazioni artistiche mancanti dallo snapshot: **2.358**, tutti i loro PNG presenti.
- ID nuovi **proposti** `20..2377` (solo ipotesi; prima del mint è obbligatoria una verifica blockchain completa contro ID già occupati).

## IPFS: blocco importante da risolvere

`baseURI()` della collezione è attualmente `ipfs://bafybeih7ucalsv5p2xh3zjrslg6fjgz7y3t4q2fivebci56mz3wex4gwj4/{id}`.

IPFS è content-addressed: non si possono aggiungere altri file nella directory con il medesimo CID. Invece di cambiare singoli token si deve **creare una nuova directory metadata** contenente, per gli ID 1–19, i JSON **identici byte per byte** e, per gli ID futuri, nuove descrizioni e link alle immagini. Solo successivamente un `setBaseURI(newURI)` autorizzato aggiornerà l'URI **per tutti i token**, anche quelli già detenuti da collezionisti. Questa decisione ha un impatto storico e richiede approvazione esplicita.

Le interrogazioni dei gateway HTTP pubblici per quattro metadata storici hanno restituito **HTTP 429 su tutti i tentativi**, quindi **non** possiamo ancora dimostrare di avere archiviato tali originali. [Log della verifica](https://github.com/Cesare-ml/nft-risuonatore-solare/actions/runs/39676765897). Non procedere a `setBaseURI` senza gli originali recuperati e confrontati.

### CLI di staging IPFS preparata

[`scripts/stage-ipfs-release.mjs`](../scripts/stage-ipfs-release.mjs), per uso locale con [Kubo](https://docs.ipfs.tech/install/command-line/) (CLI `ipfs` disponibile sul PATH), non usa API di OpenSea né segreti wallet.

```powershell
node scripts/plan-next-mints.mjs
node scripts/stage-ipfs-release.mjs            # preflight SENZA upload
node scripts/stage-ipfs-release.mjs --stage    # PIN locale, nessuna tx
```

Con `--stage`, lo script:
1. ottiene i 19 JSON storici esattamente mediante `ipfs cat` dal CID attuale (interrompe se non accessibili);
2. prepara i 2.358 PNG con nomi sicuri `RS-Cxxx-Lxx.png` tramite **hardlink** sullo stesso volume (non duplica ~900 MB);
3. aggiunge la cartella media al nodo Kubo, ottenendo un nuovo CID;
4. crea i 2.358 nuovi metadata con `image: ipfs://{mediaCID}/RS-Cxxx-Lxx.png`;
5. crea la cartella completa di **2.377** documenti (19 originali + 2358 nuovi), pinna localmente su IPFS, rilegge e confronta gli SHA256 dei 19 originali;
6. scrive il report con il nuovo CID proposto, **senza cambiare baseURI né fare mint**.

Un pin Kubo locale da solo non garantisce persistenza/disponibilità per gli acquirenti: per produzione serviranno pinning remoto ridondante, controllo gateway e backup. L'operazione `--stage` pubblica contenuti IPFS, per questo non viene lanciata automaticamente da CI.

## Piano operativo verificabile verso la pubblicazione

- **A.** Confermare che il wallet effettivamente controllato dall'artista coincide con `owner()`. Non richiedere seed/private key: basta un indirizzo pubblico, un controllo in wallet o una firma verificabile di challenge dedicata.
- **B.** Recuperare e conservare i 19 metadati originali, quindi preparare e replicare il nuovo CID IPFS preservando i JSON storici.
- **C.** Ricontrollare on-chain i nuovi token ID in tutto l'intervallo previsto, eventuali transfer/mint precedenti, `totalMinted`, `maxSupply` e supply policy. Approvare i 7 RGB duplicati e il doppio Cobalto già esistente.
- **D.** Richiedere consenso **separato** prima di un eventuale `setBaseURI` (tutti i token storici ne sono interessati), con attestazioni byte-parity e backup.
- **E.** Simulare lotti rappresentativi su fork corrente, calcolare gas/costi, predisporre checkpoint e recovery. Distinguere configurazione supply da mint; usare `multiConfigureMint` in batch compatibili con gas/block limit.
- **F.** Solo con wallet autorizzato e approvazione dei costi, inviare transazioni firmate, verificare receipt e supply; OpenSea indicizzerà i nuovi ID dello **stesso contratto**. Il listing/prezzo è una procedura successiva e distinta.

Nessuno degli script in questa versione firma transazioni reali. I file e report sotto `reports/` restano ignorati da Git.

Fonti: [ERC-1155](https://eips.ethereum.org/EIPS/eip-1155), [OpenSea Studio](https://support.opensea.io/en/articles/8867080-how-do-i-use-opensea-studio), [Kubo CLI](https://docs.ipfs.tech/reference/kubo/cli/), [Sourcify ABI](https://sourcify.dev/server/v2/contract/137/0x9f36ee33fd56c7d9a78facd3249c580b1ca464a2?fields=abi).
