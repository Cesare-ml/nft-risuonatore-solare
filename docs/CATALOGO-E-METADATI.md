# Catalogo canonico e metadati NFT

> **Nota 21/10/2026:** gli NFT storici esistenti appartengono a un **contratto ERC-1155 su Polygon**, non ERC-721. L'esempio ERC-721 più sotto è solo **esemplificativo** e NON deve essere usato per pubblicare nella collezione esistente senza adattamento allo standard ERC-1155, al contratto e alle URI effettive. [Inventario OpenSea verificato](OPENSEA-COLLEZIONE-VERIFICATA.md). Distinguere i 19 `token_id` dai 18 `artwork_id` perché i token #3 e #4 hanno entrambi colore 80, livello 8.

Data della specifica: **21 ottobre 2026**. Questo documento propone un formato di interoperabilità **senza attribuire token ID ancora sconosciuti**.

## Identità delle opere

- **108 schede colore** con `id` numerico 1–108, `nome`, `colore` (HEX), `descrizione`, `categoria`, `sottocategoria`.
- **22 profondità**, ciascuna con descrizione italiana, riferimento simbolico all'arcano e testo EN non ancora completato.
- **2.376 varianti** da `108 × 22`. Immagini sorgenti nel repository con hash Git e filename univoci, ma alcuni contenuti PNG coincidono (vedere audit).
- Identificativo interno *proposto*: `RS-C001-L01` … `RS-C108-L22`, indipendente dal token ID on-chain.
- L'ID interno è stabile anche se la blockchain, il token ID o la piattaforma di vendita cambiano.

### Naming fisico attuale

```text
nft-imgs/solar_2222px_39.00px_#FFD700_lvl22_n1.png
           └ risoluzione └ codice HEX └ livello └ ID colore
```

Percorso URL per browser (escapare il cancelletto):
`/nft-imgs/solar_2222px_39.00px_%23FFD700_lvl22_n1.png`.

Generare un percorso usando **ID, HEX e livello del catalogo**, senza cercare di dedurre l'ID dalle posizioni dopo un riordino. Non rinominare file già referenziati da eventuali token.

### Mappa campi

| Campo logico | Sorgente | Uso |
| --- | --- | --- |
| `artwork_id` | `RS-C{ID:03}-L{level:02}` | Chiave permanente off-chain |
| `color_id` | `nft-colors.json[].id` | ID 1..108 |
| `color_name` | `nft-colors.json[].nome` | Nome curatoriale |
| `hex` | `nft-colors.json[].colore` | Valore HEX |
| `category` | `nft-colors.json[].categoria` | Trait di navigazione |
| `depth` | `leveles-description.json` chiave 1..22 | Trait intero |
| `color_meaning_it` | `nft-colors.json[].descrizione` | Testo editoriale |
| `depth_meaning_it` | `leveles-description.json[level].it` | Testo editoriale |
| `image_file` | `nft-imgs/...` | Binario originale |
| `chain/contract/token_id` | Registro verificato | Da riempire **solo dopo verifica** |

Nel codice attuale i 22 archetipi del testo breve e le immagini Tarot sono mappati tramite `selectedLevel % 22`: l'indice 0 (Il Matto) corrisponde alla profondità 22, gli indici 1–21 alle profondità 1–21. **Attenzione:** l'array `tarocchiUnaParola` non è sempre allineato alla descrizione in italiano; non usarlo come unica fonte senza audit editoriale. Le immagini `tarocchi-marsigliesi/*.jpeg` sono risorse del sito: verificare licenza prima di riutilizzarle nei metadati di vendita.

## Esempio di metadati OpenSea/ERC-721 (proposta, non asset pubblicato)

```json
{
  "name": "Risuonatore Solare — Oro Puro — Profondità 22",
  "description": "[Testo curatoriale italiano normalizzato: significato del colore e profondità, senza markup HTML]",
  "image": "ipfs://<CID_VERIFICATO>/solar_2222px_39.00px_#FFD700_lvl22_n1.png",
  "external_url": "https://nft.mirkolancerotto.it/nft-colors.html",
  "attributes": [
    {"trait_type": "Serie", "value": "Risuonatore Solare"},
    {"trait_type": "ID colore", "value": 1},
    {"trait_type": "Colore", "value": "Oro Puro"},
    {"trait_type": "Codice HEX", "value": "#FFD700"},
    {"trait_type": "Categoria", "value": "Metalli"},
    {"trait_type": "Profondità", "value": 22},
    {"trait_type": "ID opera", "value": "RS-C001-L22"}
  ]
}
```

`<CID_VERIFICATO>` e la descrizione tra parentesi quadre sono **placeholder**, non URL o dati da inviare. La forma ufficiale dipende dal contratto: ERC-721 usa `tokenURI(tokenId)`; ERC-1155 usa `uri(id)` e può usare placeholder `{id}` a 64 caratteri esadecimali (vedere documentazione OpenSea). Per file su IPFS con `#` nel nome, testare la corretta risoluzione URI su più gateway oppure normalizzare **solo una nuova copia destinata all'upload** (es. `RS-C001-L22.png`) mantenendo un mapping/hash dalla sorgente.

### Normalizzazione dei testi

I campi attuali sono in italiano e possono contenere HTML (`<p>`, `<strong>`, `<br>`) o ritorni a capo. Il generatore di metadati deve:
1. estrarre il testo senza tag, conservando paragrafi e accenti;
2. non inventare contenuti EN: i testi EN mancanti restano esplicitamente incompleti;
3. evitare boilerplate identico fra tutti i token: combinare significato specifico del colore e livello, preservando la voce artistica;
4. impedire HTML o caratteri non validi nel CSV/JSON; validare Unicode, quoting, file associato, lunghezza e titolo;
5. registrare `source_revision`, SHA-256 del media, CID e versione dei metadati.

Per i futuri deep link da `external_url` conviene supportare query tipo `?color=1&level=22` **solo dopo averne implementato e testato la navigazione**; oggi il frontend non legge questi parametri.

## Supply e token ID

NON scegliere una formula per l'effettivo `token_id` prima del controllo della collezione già mintata. Una formula (es. indice sequenziale per colore o per livello) può servire per i **nuovi** contratti ma potrebbe confliggere con NFT storici. `artwork_id` e `token_id` rimangono due colonne distinte.

Proposta supply ERC-721 (solo se coerente con contratto e decisione artistica): **una unità per ciascuna delle 2.376 varianti**; ERC-1155 consentirebbe più copie e richiede una decisione diversa. Le sette coppie di colore con HEX uguale riducono a 101 i colori RGB unici e a **2.222 i file PNG con hash univoco**: preservare la distinzione semantica ma valutare e approvare le copie visive prima di mintarne altre.

Fonti tecniche:
- https://docs.opensea.io/docs/metadata-standards
- https://docs.opensea.io/docs/metadata-storage
- https://docs.opensea.io/docs/contract-level-metadata
