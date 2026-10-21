# Stato di minting: riconciliazione prima dell'automazione

**Importante (21 ottobre 2026):** l'artista riferisce che alcuni NFT sono già stati pubblicati/mintati su OpenSea. Non è stato possibile stabilire da questo repository **quali** siano, in **quale contratto/rete** o quanti. Non assegnare a quelli non documentati lo stato `not_minted`: usare `unverified`.

## Dati da recuperare una volta sola

- URL della/e collezione/i OpenSea già create e relativo slug.
- Nome della blockchain (es. Ethereum, Polygon, Base: **non assumere**).
- Contract address e standard ERC-721/ERC-1155, eventuali contratti multipli.
- Wallet creatore autorizzato (indirizzo **pubblico**, mai seed phrase o chiave privata).
- Tipo di pubblicazione effettuata: `Collection / item`, `Drop`, altro; possibilità reale di proseguire *nello stesso* contratto.
- URL item già mintati, `token_id`, `tx_hash`, data di mint, metadati attuali e URI, eventuale prezzo/listing.
- Eventuali differenze fra i PNG originali e i media effettivamente collegati a ciascun token.

## Tabella logica proposta

Ogni riga rappresenta una delle 2.376 combinazioni del catalogo, non uno stato di vendita:

| Campo | Esempio | Note |
| --- | --- | --- |
| `artwork_id` | `RS-C001-L22` | Identificativo interno, univoco |
| `color_id`, `depth` | `1`, `22` | Origine JSON e filename |
| `image_path` | `nft-imgs/solar_..._lvl22_n1.png` | Media repository |
| `image_sha256` | `null` inizialmente | Hash immutabile, non confondere con SHA Git |
| `mint_status` | `unverified` | `unverified` / `not_minted` / `minted` |
| `chain`, `contract_address`, `token_id` | `null` | Determinanti per unicità del token |
| `mint_tx_hash`, `minted_at_utc` | `null` | Evidenza transazione on-chain |
| `metadata_uri`, `media_uri` | `null` | URI realmente presenti al momento della verifica |
| `opensea_url` | `null` | Collegamento indice marketplace |
| `listing_status` | `unknown` | Indipendente dal mint; es. listed / unlisted |
| `verified_at_utc`, `verification_source` | `null` | Fonte/tempo sincronizzazione |

Per le sole 2.376 combinazioni è possibile generare un manifest locale `unverified` senza mintare nulla. La distinzione è fondamentale: un NFT già mintato ma successivamente venduto **resta mintato**; non cercarlo soltanto nel wallet del creatore.

### Come verificare

1. Partire da contratto + chain o collection slug, NON soltanto da wallet (il creator potrebbe avere venduto token).
2. Elencare i token per contratto con paginazione (`GET /api/v2/chain/{chain}/contract/{address}/nfts`) oppure per collezione (`GET /api/v2/collection/{slug}/nfts`).
3. Leggere i token candidati e relativa `metadata_url` / URI, `traits`, nome e immagine; effettuare confronto affidabile con ID/HEX/livello e SHA del media quando possibile.
4. Incrociare explorer blockchain per transazioni/eventi di mint, token supply, ownership, contract e token ID. OpenSea è un **indice**, non il registro autoritativo di chain.
5. Marcare `minted` solo con evidenza verificabile; marcare `not_minted` solo dopo inventario completo di **tutti** i contratti pertinenti.
6. Se un token on-chain non si lascia ricondurre inequivocabilmente alla combinazione, lasciarlo in coda revisione manuale; mai associare per posizione o inventare una corrispondenza.
7. Esportare un report: `minted`, `not_minted`, `unverified`, mismatch metadati, eventuali conflitti/duplicati, link pubblici.

**Non includere segreti** nel repository. Un eventuale manifest pubblico può contenere indirizzi e tx pubbliche, ma controllare prima i dati personali e la strategia di pubblicazione.

Link tecnici:
- https://docs.opensea.io/reference/get_nfts_by_contract
- https://docs.opensea.io/reference/get_nfts_by_collection
- https://docs.opensea.io/reference/get_nft
- https://docs.opensea.io/reference/get_nfts_by_account (non sufficiente da solo per una collezione venduta)
