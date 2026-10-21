# Risuonatore Solare — archivio NFT

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

**Non è stata avviata alcuna operazione on-chain.** Prima di generare token, cambiare metadati pubblicati o caricare file su OpenSea, eseguire la riconciliazione dei mint esistenti descritta nelle guide. Le 108 schede non corrispondono a 108 HEX diversi: vedere [audit](docs/AUDIT-2026-10-21.md).
