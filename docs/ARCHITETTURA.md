# Architettura del progetto

Ultima ricognizione: **21 ottobre 2026**. Documentazione dell'implementazione corrente (non di un sistema di mint già funzionante).

## Sito statico

- Deploy statico previsto dal repository: `CNAME` = `nft.mirkolancerotto.it`. L'hosting effettivamente attivo e i redirect vanno verificati separatamente.
- **`nft-colors.html` è la pagina principale logica** indicata dall'artista, ma non esiste `index.html` nella root esaminata: il dominio senza percorso potrebbe non aprirla automaticamente, a meno di routing/redirect esterni.
- `npm start` avvia `http-server .` (vedere `package.json`); nessun framework/bundler applicativo o backend wallet risulta implementato qui.
- CSS da `assets/css/main.min.css` e sorgente `assets/sass/main.sass`.
- Le immagini sono nel repository; nessun collegamento on-chain è codificato nel frontend.

### Flusso di rendering del catalogo

```text
nft-colors.html
  └─ assets/js/main.js
       ├─ GET /assets/json/nft-colors.json?timestamp=...
       ├─ GET /assets/json/leveles-description.json?timestamp=...
       ├─ loadColors(...) → elenco filtri per categoria
       └─ loadNFT(color.id)
            ├─ #color / 108 e nome / significato
            ├─ <img> da /nft-imgs/solar_..._lvl{depth}_n{colorId}.png
            └─ arcano, parola simbolica, descrizione livello
```

La selezione iniziale è **colore ID 1, livello 22**. Il filtro a sette categorie (`Caldi`, `Freddi`, `Pastello`, `Terrosi`, `Verdi`, `Viola`, `Metalli`) legge `categoria` dal JSON. `loadNFT(id)` usa `colorsData[id - 1]`: l'array deve restare ordinato per ID crescente e consecutivo finché il codice non verrà reso indipendente dall'indice.

`leveles-description.json` contiene oggetti con chiavi stringa `"1" .. "22"`, ognuno con `it` e `en`. Il selettore lingua dell'HTML è commentato, mentre `main.js` inizializza `language = 'it'`.

La pagina mostra un'immagine alla volta; **le combinazioni possibili sono 2.376**, non ci sono 2.376 card simultanee. I significati sono dati editoriali (colore e livello), non prove on-chain.

### Altri moduli

- `risuonatore-nft.html`: generatore originale da canvas 2222×2222, sezione aurea (`phi = 1.61803399`), due cerchi complementari per profondità e generazione ZIP con JSZip. È un generatore/strumento, **non** un minter.
- `heart-nft.html` / `assets/js/main-heart.js`: composizione SVG con `assets/svg/heart-nft.svg`, sfondo del colore scelto livello 22, variazione dei gradienti e download SVG/PNG. Trattarlo come prodotto parallelo/prototipo, **non mischiarlo alla supply 2.376** senza nuova decisione.
- `python/gen-csv.py`: converte gli attuali JSON in `python/out/nft-colori.csv` e `python/out/nft-livelli.csv`. Questo export **non** è un manifest pronto per OpenSea: non contiene 2.376 righe né tokenID, file_name e attributi combinati.

## Responsabilità e sorgenti di verità

| Ambito | Origine oggi | Origine futura consigliata |
| --- | --- | --- |
| Identità della singola opera | `color.id` + `level` | Identificativo interno stabile `RS-Cnnn-Lnn` |
| Titolo/HEX/significato colore | `assets/json/nft-colors.json` | Stesso catalogo versionato, con validatore |
| Significato del livello | `assets/json/leveles-description.json` | Stesso catalogo versionato, con localizzazioni controllate |
| Media | `nft-imgs/*.png` | Hash e URI durevoli immutabili, collegati al catalogo |
| Token on-chain | **Non nel repository** | Ledger verificato da contratto, catena e tx |
| Stato listing OpenSea | **Non nel repository** | Sincronizzazione read-only, mai inferita da immagini |

## Vincoli

Non sostituire un'immagine o un significato riferito a un token già esistente senza confrontare la sua URI corrente e la politica di mutabilità del contratto. Non cambiare automaticamente ID o ordine del catalogo. Il percorso del PNG include il carattere `#`: nelle richieste URL dev'essere escapato come `%23` (già previsto in `main.js`).

Per inventario e problemi osservati vedere [audit](AUDIT-2026-10-21.md).
