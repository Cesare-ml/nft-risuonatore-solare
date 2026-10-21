# Pubblicazione e automazione OpenSea

> **Decisione tecnica aggiornata (21/10/2026):** la collezione reale [Solar Resonator | Quantum NFT Collection](https://opensea.io/collection/solar-resonator-quantum-nft-collection) è **ERC-1155 su Polygon**, contratto `0xead98e12d3836562ea39c6a6ca5ef1292359a862`. **Le API bulk/manifest per i Drop descritte più sotto NON sono direttamente applicabili a questa collezione ERC-1155 Studio.** Secondo la [FAQ ufficiale OpenSea](https://support.opensea.io/en/articles/8867028-creator-faq), `Create Collection` **non permette bulk upload**: gli item si caricano singolarmente da Studio. La pipeline proposta per i Drop è una **alternativa con eventuale nuovo contratto**, non il piano predefinito di questa collezione. Vedi [inventario verificato](OPENSEA-COLLEZIONE-VERIFICATA.md).

## Percorso prioritario per IL CONTRATTO ESISTENTE

1. Conservare chain Polygon + ERC-1155 + contratto storico, e predisporre automaticamente i **metadati e le immagini** già disponibili; identificare e saltare le 18 combinazioni già rappresentate da 19 token OpenSea.
2. **Verificare on-chain** con ABI e log di mint quali operazioni il wallet creatore è autorizzato a eseguire e se i metadata possono essere attribuiti programmaticamente; nessuna firma/trasferimento automatico senza approvazione.
3. In assenza di una funzione sicura di minting programmabile nel contratto, procedere tramite **OpenSea Studio item-per-item** con asset e campi già pronti, oppure decidere consapevolmente l'eventuale nuovo Drop.
4. **NON** inviare i media all'API `/drops/.../items` presumendo che aggiorni i token ERC-1155 esistenti. Il caricamento di media, il mint e il listing restano operazioni differenti.
5. La supply ERC-1155 può superare 1 per token ID: non calcolare i NFT posseduti a partire dai soli 19 ID.

Ricognizione fonti ufficiali: **21 ottobre 2026**. **Non è stato eseguito alcun upload né mint.** Scopo: rendere riproducibili preparazione, caricamento, riconciliazione e monitoraggio senza creare NFT duplicati.

## Prima decisione: conservare la collezione già avviata

L'artista ha già provato a mintare su OpenSea. **Prima** di scegliere tool o blockchain recuperare `collection_slug`, `chain`, `contract_address`, `token_id` degli item esistenti (vedere [registro](REGISTRO-MINT.md)).

Esistono percorsi **diversi** e non intercambiabili:

| Scenario | Strategia |
| --- | --- |
| Item già mintati tramite OpenSea Studio `Create Collection` | Verificare se contratto/standard corrente consente nuovi mint programmati; non assumere che l'API upload di *drop* sia utilizzabile |
| Drop OpenSea compatibile | Valutare API `/api/v2/drops/{slug}/items/...` per import massivo dei contenuti **nel drop stesso** |
| Contratto proprietario ERC-721/1155 | Generare media + metadata URI; eventuale mint tramite transazioni firmate verso il contratto, mentre OpenSea indicizza i token |
| Contratto incompatibile o impossibile da estendere | Decisione curatoriale consapevole: mantenere storici separati o migrare; non farlo automaticamente |

### Upload massivo per drop: API disponibili

Le documentazioni OpenSea aggiornate descrivono:

- `POST /api/v2/drops/{slug}/items/media`: avvio upload immagini, con `upload_batch_id` nei flussi batch.
- `POST /api/v2/drops/{slug}/items/manifest`: manifest CSV con campi richiesti **`tokenID`, `name`, `description`, `file_name`**; il filename deve coincidere esattamente col file media caricato. Attributi opzionali.
- `POST /api/v2/drops/{slug}/items/media/save-batch`: salva i media e i metadati del batch (fino a 15.000 filename). **ATTENZIONE: ogni save sostituisce la lista di item del drop**; non eseguirlo su un drop esistente senza backup/list e verifica completa. Non disponibile per ERC-1155 self-mint drop.
- `GET /api/v2/drops/{slug}/items`: leggere il risultato salvato, anche nel draft, per confronto.
- `POST /api/v2/drops/{slug}/metadata/ipfs`: per **SeaDrop V1 ERC-721**, pubblica il set dei metadata/media su IPFS e aggiorna la draft base URI. È una fase distinta dalla pubblicazione sul contratto; poi il workflow ufficiale prevede `/publish`. Seguire/attendere lo stato del job e approvare manualmente la pubblicazione.
- `POST /api/v2/drops/{slug}/mint`: restituisce dati transazione **da firmare ed inviare**; non esegue automaticamente la firma/mint.

Queste API richiedono che la **tipologia di collezione sia supportata** e che il wallet abbia i permessi corretti. Le API per dati pubblici usano `X-API-KEY`; scritture legate al wallet richiedono anche JWT wallet con scope mirato (es. `write:drops`, secondo la documentazione attuale). Le URL di upload firmate, i token e i campi temporanei vanno trattati come segreti a breve durata.

**Non confondere** caricamento di media/metadati nel *draft* con mint sul chain, apertura di un drop o listing commerciale. Sono eventi separati e verificabili.

## Pipeline proposta (Node.js, CLI prima di interfaccia)

```text
A. AUDIT READ-ONLY
   fetch OpenSea+RPC → inventario dei mint esistenti
   → linkage artwork_id ↔ chain/contract/token_id
B. BUILD OFFLINE
   leggi 108 colori + 22 descrizioni + 2376 PNG
   → validazione + SHA256 + normalizzazione testo
   → 2376 record "artwork_id" e manifest OpenSea/JSON ERC compatibile
C. REVIEW
   diff vs mint esistenti
   → escludi token minted e id ambigui
   → preview immagini/metadata/trait, controllo doppioni
D. UPLOAD (esplicita approvazione, solo se compatibile)
   upload batch con resume e retry → conferma upload
   → save e verify per drop, oppure pin su storage decentralizzato
E. PUBLISH/MINT (approvazione SEPARATA)
   firma controllata; chain corretta; limiti costi/transazioni
   → conferme block explorer
F. RECONCILE
   refresh metadata se necessario → link OpenSea
   → report puntuale di riusciti, falliti e da verificare
```

### Robustezza e idempotenza

- `dry-run` di default; `--apply` esplicito dopo preview e confronto con registro chain.
- Chiave di lavoro **`chain:contract:token_id`** per minted e **`artwork_id`** per asset off-chain. Nessun retry può produrre un secondo mint per una stessa chiave verificata.
- Checkpoint di upload con hash, nome, CID/token di riferimento **non segreto**, stato, tentativi e tempi; per URL/token presigned temporanei rispettare le regole del provider e **non loggare/persistire segreti**.
- Limiti di richieste, retry con backoff su 429/5xx, controllo di esistenza, timeout, verifica post-upload.
- Gestione ~904 MB di PNG per streaming/batch, senza caricare tutto in RAM né rigenerare file già corretti.
- Controllo **unico** manifest (righe, tokenID non duplicati, filename non duplicati, attributi, encoding CSV, UTF-8). Nessuna scelta automatica di tokenID finché non si conosce il contratto.
- Se si sceglie IPFS proprio: pin multiplo, verifica CIDs/URI, backup e previsione costi; URI con `#` del filename da validare o rinominare nella **copia upload**.
- Ambiente test/sandbox ove disponibile e pochi asset campione non già mintati; **mai prove sul contratto produzione senza consenso esplicito**.

## Differenza fra alternative

**OpenSea Studio (manuale).** Già utile per collezioni o singoli item; possibile drop con metadata CSV e media. Buona prova di visualizzazione ma inefficiente item-per-item.

**API drops OpenSea.** Scelta promettente per un **drop compatibile** e una procedura da 2.376 file, con manifest/salvataggio e successiva pubblicazione. Non è una API universale per mintare qualsiasi collezione esistente. Prima verifica dello standard specifico, dei permessi e delle eventuali limitazioni del contratto.

**Contratto proprio + IPFS.** Massimo controllo su tokenURI, supply, diritti, mint e proof di provenienza. Maggiori costi di sviluppo/sicurezza e necessità di audit; OpenSea resta marketplace/indexer. Non risolvere con un nuovo contratto senza decidere come trattare i token storici.

## Minime informazioni prima dello sviluppo dell'uploader

1. **Link** di almeno un NFT già mintato o della collezione OpenSea.
2. Catena, contratto e standard reali, recuperabili anche dal link.
3. Conferma del modello di vendita: mint nel wallet dell'artista, oppure drop acquistabile dagli utenti; supply 1 o multipla per variante.
4. Approvazione della scelta sui 7 HEX duplicati; localizzazioni IT/EN; contenuti e diritti.
5. Budget gas/upload e preferenze di custodia chiavi. **Non inviare seed phrase o private key in chat o repository.**

## Fonti ufficiali (URL da rivalidare prima dell'implementazione)

- Create a collection: https://support.opensea.io/en/articles/8867023-how-do-i-create-an-nft
- Create a drop: https://docs.opensea.io/docs/create-a-drop
- Upload media/metadata da Studio: https://docs.opensea.io/docs/part-3-upload-metadata
- Manifest drop: https://docs.opensea.io/reference/upload_drop_collection_manifest
- Batch save (sostituisce item): https://docs.opensea.io/reference/save_drop_item_media_batch
- List draft items: https://docs.opensea.io/reference/list_drop_items
- Metadata drop IPFS: https://docs.opensea.io/reference/upload_drop_metadata_to_ipfs
- Mint tx drop: https://docs.opensea.io/reference/build_drop_mint_transaction
- Auth/API key + JWT wallet: https://docs.opensea.io/reference/auth
- Metadata ERC: https://docs.opensea.io/docs/metadata-standards
- Storage: https://docs.opensea.io/docs/metadata-storage

**Regola di sicurezza:** la progettazione e il dry-run non sono autorizzazione ad agire su blockchain o a modificare il draft OpenSea.
