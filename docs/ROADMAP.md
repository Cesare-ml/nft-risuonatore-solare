# Roadmap — Risuonatore Solare NFT

**Aggiornamento 21/10/2026:** completata la scoperta del contratto esistente: [Polygon ERC-1155, 19 token IDs / 18 combinazioni](OPENSEA-COLLEZIONE-VERIFICATA.md). Lavoro P0 successivo: verifica ABI e ruolo minter, transazioni/URI/supply e decisione sul doppio token della variante Cobalto #80 livello 8. **Non usare il bulk upload del Drop sul contratto esistente** senza prova di compatibilità; la FAQ OpenSea esclude bulk upload nella modalità Create Collection.

Data iniziale: **21 ottobre 2026**. Filosofia: preservare l'opera e gli NFT esistenti; automatizzare prima i controlli, poi eventuali upload e mint.

| Priorità | Lavoro | Criterio di conclusione |
| --- | --- | --- |
| **P0** | Riconciliare i mint già realizzati | Chain, contract, token ID, tx, URI e 2.376 chiavi `artwork_id` in report senza assunzioni |
| **P0** | Deliberare sui **7 HEX ripetuti** (154 coppie di PNG identici) | Decisione artistica documentata; nessuna modifica retroattiva non verificata |
| **P0** | Definire modello mint (Studio item / drop / contratto proprio) e supply | Piano coerente con contratto esistente, costi e diritti |
| **P1** | Validatore di catalogo e PNG | 108×22, ID, HEX, descrizioni, SHA256, duplicati, URL e report ad ogni build |
| **P1** | Manifest/metadati generati offline | 2.376 record, testo normalizzato, traits, mapping ID, JSON/CSV testati in `dry-run` |
| **P1** | Versionamento dei media e storage | Pin/URI o upload staging verificato; nessuna URI rotta |
| **P1** | Traduzioni EN | Tutti e 22 i livelli EN editorialmente validati, poi colore/landing multilingua |
| **P2** | Uploader compatibile col tipo di collection | Checkpoint, resume, retry, filtri già mintati, anteprima, approvazione, audit log |
| **P2** | Mint/publish separato dall'upload | Firme autorizzate, budget, controllo doppioni, conferma on-chain |
| **P2** | Stato pubblico catalogo | Ogni variante mostra solo stati verificati e link OpenSea corretti |
| **P3** | UX/catalogo | Deep link colore+profondità, responsive, lazy-load, ricerca e accessibilità |
| **P3** | Operatività continuativa | Sincronizzazione cron read-only, alert errori, controllo disponibilità IPFS/media |

## Principi

- `nft-colors.html` resta il **punto di accesso artistico**: nomi, immagini, significati. Evitare riscritture premature o frontend amministrativi complessi.
- L'eventuale backend può essere una CLI Node per batch: non serve creare subito un gestionale.
- **Tre approvazioni distinte**: contenuti/metadati; upload/pinning; azioni on-chain/mint e listing.
- Salvare nelle documentazioni le scelte effettive; mai introdurre URL/contract/token ID presunti.
- Non confondere **immagine presente**, **metadata preparato**, **upload effettuato**, **token mintato**, **item listato**, **item venduto**.
- Qualunque integrazione deve funzionare senza segreti nel frontend o in Git.

## Primo intervento di sviluppo suggerito

Un comando locale tipo `npm run nft:audit` che legga JSON + filesystem, controlli tutti i 2.376 PNG, segnali HEX e file duplicati, e generi un **manifest dry-run**. Subito dopo, un import read-only degli NFT esistenti per riconciliare stato e metadata. Soltanto dopo sviluppare l'uploader OpenSea per il tipo di contratto effettivo.
