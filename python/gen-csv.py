import json
import csv

# Percorsi dei file JSON
nft_colors_path = "../assets/json/nft-colors.json"
nft_levels_path = "../assets/json/leveles-description.json"

# Dati dei Tarocchi
TAROCCHI_UNA_PAROLA = [
    "Creatività", "Nuovo Inizio", "Saggezza", "Fertilità", "Potere",
    "Spiritualità", "Scelta", "Vittoria", "Coraggio", "Introspezione",
    "Cambiamento", "Equilibrio", "Riflessione", "Trasformazione", "Armonia",
    "Tentazione", "Distruzione", "Speranza", "Illusione", "Gioia",
    "Resurrezione", "Completezza"
]

# Carica i dati JSON
def load_json(file_path):
    with open(file_path, "r", encoding="utf-8") as file:
        return json.load(file)

# Salva i dati in un file CSV con gestione dei ritorni a capo
def save_csv(file_path, data, headers):
    with open(file_path, "w", newline="", encoding="utf-8") as file:
        writer = csv.writer(file, quoting=csv.QUOTE_MINIMAL)
        writer.writerow(headers)
        for row in data:
            row = [str(value).replace("\n", "<br>") for value in row]  # Sostituisce \n con <br>
            writer.writerow(row)



# Genera il file nft-livelli.csv
def generate_nft_levels_csv():
    nft_levels = load_json(nft_levels_path)
    data = []
    for idx, parola in enumerate(TAROCCHI_UNA_PAROLA, start=1):
        descrizione_it = nft_levels.get(str(idx), {}).get("it", "")
        data.append([parola, descrizione_it])
    save_csv("out/nft-livelli.csv", data, ["Parola del Livello", "Descrizione in Italiano"])

# Genera il file nft-colori.csv
def generate_nft_colors_csv():
    nft_colors = load_json(nft_colors_path)
    data = []
    for color in nft_colors:
        data.append([color["id"], color["nome"], color["descrizione"], color["colore"], color["categoria"]])
    save_csv("out/nft-colori.csv", data, ["ID", "Nome", "Descrizione", "Colore", "Categoria"])

# Esegui la generazione dei file CSV
generate_nft_levels_csv()
generate_nft_colors_csv()

print("File CSV generati con successo!")
