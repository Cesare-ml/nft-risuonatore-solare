# Audit contratto Polygon ERC-1155 — fase 1

## Risultati blockchain verificati — 21/10/2026

La CLI è stata **eseguita realmente** da una GitHub Actions runner con RPC Polygon pubblico e ha ottenuto risultati:

- **Chain ID 137**, contract `0xead98e12d3836562ea39c6a6ca5ef1292359a862` presente, bytecode **45 bytes** (blocco 95938345).
- **Minimal proxy EIP-1167 standard** identificato dal runtime: implementazione **[`0x9f36ee33fd56c7d9a78facd3249c580b1ca464a2`](https://polygonscan.com/address/0x9f36ee33fd56c7d9a78facd3249c580b1ca464a2)**, bytecode implementazione **17.857 byte**.
- `owner()` chiamato **sul proxy della collezione**, restituisce **`0x2180747f94c3319162137a0e2ca5b1e8c7efb2ed`**; **non prova il ruolo minter** e non identifica automaticamente la persona fisica proprietaria.
- `supportsInterface` via `eth_call`: ERC-165, ERC-1155 e metadata URI = **true**.
- `uri(id)` per gli **ID 1–19** restituisce senza errori **`ipfs://bafybeih7ucalsv5p2xh3zjrslg6fjgz7y3t4q2fivebci56mz3wex4gwj4/{id}`**. Per `{id}` valgono 64 cifre HEX. La URI restituita non certifica che l'ID sia stato mintato, né la disponibilità effettiva del JSON sul gateway.
- L'ABI verificata **non è stata ottenuta** attraverso Blockscout nella prima esecuzione. La CLI prova ora anche Sourcify v2 e, se configurata, Etherscan v2; la possibilità concreta di mint resta non verificata.

Report completo (artefatto temporaneo GitHub Actions): [run 39666627099](https://github.com/Cesare-ml/nft-risuonatore-solare/actions/runs/39666627099). La CLI e i decoder hanno superato anche [i test offline](https://github.com/Cesare-ml/nft-risuonatore-solare/actions/runs/39666627289).

**Attenzione:** la sezione seguente, redatta prima del controllo RPC, include affermazioni storiche sullo stato inizialmente non verificato. I valori qui sopra prevalgono sulle precedenti incertezze per rete, standard, proxy, implementazione, `owner()` e URI.

---
Data: **21 ottobre 2026**. Contratto: [`0xead98e12d3836562ea39c6a6ca5ef1292359a862`](https://polygonscan.com/address/0xead98e12d3836562ea39c6a6ca5ef1292359a862), chain ID **137 (Polygon mainnet)**.

## Risultato della ricognizione

- **Confermato su OpenSea:** 19 token ID visibili, associati a 18 coppie colore/profondità; ERC-1155 Polygon secondo le pagine item. Fonte: [collezione](https://opensea.io/collection/solar-resonator-quantum-nft-collection) e [inventario](OPENSEA-COLLEZIONE-VERIFICATA.md).
- **Confermato dalle regole OpenSea:** Studio «Collection or item» usa ERC-1155 e **non supporta bulk upload**. Sono invece disponibili bulk media/manifest per **Drop ERC-721**: non applicarli direttamente al contratto storico.
- **NON ANCORA VERIFICATO SULLA CHAIN:** bytecode effettivo, ABI sorgente verificata, proxy/implementazione, funzioni di mint, autorizzazioni minter, controlli proprietario, URI di ogni token, supply, transazioni di mint. Gli explorer/API non erano consultabili direttamente nell'ambiente di analisi: non è corretto affermare che un metodo mint esista solo perché è standard ERC-1155.
- **Confermata la documentazione RPC (2026):** i vecchi RPC Polygon-operated (es. `polygon-rpc.com`) sono stati dismessi a luglio 2026. Si usa come default il public RPC dRPC `https://polygon.drpc.org` indicato dalla [documentazione Polygon](https://docs.polygon.technology/pos/reference/rpc-endpoints). Può applicare limiti; per una verifica ripetibile meglio un RPC privato o stabile.

**Conclusione:** ad oggi la fattibilità di minting automatizzato **nello stesso contratto** è **INDETERMINATA**. Non sono stati firmati messaggi o inviate transazioni.

## Comando di audit read-only implementato

Nel repository: [`scripts/audit-polygon.mjs`](../scripts/audit-polygon.mjs). Node.js **>=18**; usa `fetch` nativo e nessuna libreria wallet/web3, né chiavi private.

```powershell
npm run nft:chain:test
npm run nft:chain:audit -- --out reports/polygon-audit.json
```

Lo script esegue soltanto:

1. `eth_chainId` — rifiuta qualunque rete diversa dalla **137**.
2. `eth_blockNumber`, `eth_getCode` — verifica che esista bytecode all'indirizzo noto.
3. `eth_call` a `supportsInterface` — ERC-165, ERC-1155, ERC-1155 Metadata URI (risultato vero/falso/errore).
4. `eth_call` a `uri(uint256)` per **tutti i 19 token ID** del manifest — legge URI originali e sostituisce il placeholder ERC-1155 `{id}` con token ID esadecimale padded a 64 cifre. **L'URI di un ID non ne certifica l'esistenza/mint.**
5. `GET` dell'ABI verificata **in sola lettura** da Blockscout; se non disponibile e la variabile `ETHERSCAN_API_KEY` è presente, tenta Etherscan API V2 Polygon; altrimenti `--abi percorso/local.json`. Elenca firme e metodi *candidati*, non attribuisce permessi né conferma la sicurezza del mint.
6. Facoltativo: `eth_getLogs` per eventi `TransferSingle` e `TransferBatch` da indirizzo zero (= mint) fra due numeri di blocco esplicitamente indicati; nessuna inferenza «non mintato» da una finestra parziale.

Il report JSON viene salvato **solo** con `--out` (può contenere URI pubbliche e indirizzi pubblici). Senza questa opzione viene stampato su stdout. Non scrive nel contratto, non richiede accesso al wallet, non contiene chiamate `eth_sendTransaction` né `eth_sendRawTransaction`. Le variabili d'ambiente usate non vengono copiate nel report.

### Cambiare RPC o fornire ABI

```powershell
$env:POLYGON_RPC_URL = 'https://polygon.drpc.org'
npm run nft:chain:audit -- --out reports/polygon-audit.json
npm run nft:chain:audit -- --abi .\abi\contract-verified.json --out reports/polygon-with-abi.json
```

Per Etherscan V2 Polygon la variabile facoltativa è `ETHERSCAN_API_KEY`; non inserire questa chiave nel repository. L'ABI va estratta dal **contratto/implementazione verificati**: se si tratta di un proxy bisogna anche comprendere l'implementazione.

### Scansione eventi on-chain

```powershell
npm run nft:chain:audit -- --from-block N --to-block M --out reports/events-N-M.json
```

- `N` e `M` sono **blocchi reali**: non inventare il blocco di deploy. Recuperarlo dalla transazione di creazione verificata con PolygonScan/Blockscout.
- Massimo **100.000 blocchi per invocazione** con query chunk da 2.000 per evitare overload dei provider pubblici; concatenare finestre contigue per coprire tutta la storia. Non ci sono scansioni complete implicite.
- Gli eventi filtrano `_from = address(0)`; registrano token ID, quantità, destinatario, hash transazione e blocco. Anche una scansione completa dei mint **non basta** a conoscere la supply attuale, perché esistono burn; per quella servono burn/eventi netti o `totalSupply` accertata con l'ABI.
- Non trattare come «not minted» alcun ID sconosciuto senza la scansione esaustiva e senza aver identificato tutte le collezioni/contratti di riferimento.

## Come stabilire davvero la possibilità di mint automatico

1. Leggere ABI verificata, compilatore, eventuale proxy e implementazione; identificare esattamente le **funzioni state-changing** che creano nuovi token e impostano metadati (non dedurle dal nome).
2. Accertare chi può chiamarle: `owner`, `MINTER_ROLE`, access control, ruolo OpenSea Studio/operatore, eventuale factory. Verificare lo **stato attuale** dal contratto, non dal wallet presunto.
3. Analizzare `uri(id)` e il meccanismo di storage: per nuovi token è necessaria un'URI immutabile e valida, e ci sono regole speciali sui token ERC-1155. Stabilire la supply prevista per variante.
4. Simulare localmente la chiamata **senza broadcasting** usando `eth_call` dal wallet appropriato (solo indirizzo pubblico), poi verificare gas e policy di operazione. Una simulazione riuscita non costituisce una garanzia.
5. Ottenere autorizzazione per ogni fase di caricamento/firma/mint. Progettare idempotenza in base a token ID, asset ID, tx e conferme on-chain.

**Se il contratto non consente mint via codice da un wallet esterno**, il percorso sicuro resta OpenSea Studio item-per-item, con immagini e metadati preparati automaticamente; una nuova collezione Drop cambierebbe contratto e va deliberata a parte.

## Ulteriori riferimenti

- [EIP-1155](https://eips.ethereum.org/EIPS/eip-1155) — ERC-165, `uri`, `{id}` e eventi transfer/mint.
- [OpenSea Studio](https://support.opensea.io/en/articles/8867080-how-do-i-use-opensea-studio) — ERC-1155 vs Drop ERC-721, no bulk Studio.
- [OpenSea creator FAQ](https://support.opensea.io/en/articles/8867028-creator-faq) — upload singolo per Create Collection.
- [Polygon RPC](https://docs.polygon.technology/pos/reference/rpc-endpoints) — endpoint e chain ID 137.
- [Etherscan API V2](https://docs.etherscan.io/api-reference/endpoint/getabi) — recupero ABI verificata.
