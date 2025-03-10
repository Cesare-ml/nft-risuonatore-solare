var colorsData = [];
var levelsDescription = [];
var selectedNFT = 0;
var language = 'it';  // Default language

// Carica il file JSON
fetch('/assets/json/nft-colors.json?timestamp=' + new Date().getTime())
    .then(response => response.json())
    .then(colorsD => {
      fetch('/assets/json/leveles-description.json?timestamp=' + new Date().getTime())
          .then(response => response.json())
          .then(levelsD => {
              colorsData = colorsD;
              levelsDescription = levelsD;
              loadColors(colorsData);
              loadNFT(1);
          })
          .catch(error => {
              console.error('Errore nel caricamento del file JSON:', error);
          });
    })
    .catch(error => {
        console.error('Errore nel caricamento del file JSON:', error);
    });


// Funzione per caricare i colori nella pagina
function loadColors(colors) {
    const container = document.getElementById('color-list');
    const selectedLevel = document.getElementById('level-filter').value;
    container.innerHTML = '';  // Svuota il contenitore

    colors.forEach((color, index) => {
      //colors[index].id=index+1;
        const colorElement = document.createElement('div');

        colorElement.classList.add('color-element');
        colorElement.innerHTML = `
            <div class="color-id">
              #${color.id}
            </div>
            <div class="color-box" style="background-color: ${color.colore}">
              <div class="color-name">${color.nome}</div>
            </div>
            <!--<div class="color-category">${color.category}</div>-->
        `;

        // Aggiungi il listener per il click che chiama loadNFT(index)
        colorElement.addEventListener('click', () => {
            loadNFT(color.id);
        });
        container.appendChild(colorElement);
    });

    console.log(colors);
}
function loadNFT(id) {
    selectedNFT = id;

    const container = document.getElementById('nft-dettagli');
    const containerLivello = document.getElementById('descrizione-livello-inner');
    const selectedLevel = document.getElementById('level-filter').value;
    const levelDescription = getLevelDescription(selectedLevel);

    const color = colorsData[id-1];

    var imgTag = container.getElementsByTagName("img")[0];
    var nDiv = container.getElementsByClassName("n")[0];
    var colorBoxDiv = container.getElementsByClassName("color-box")[0];
    var colorNameText = container.getElementsByClassName("color-name")[0].getElementsByClassName("text")[0];
    var colorMeaningDiv = container.getElementsByClassName("color-meaning")[0];

    imgTag.src = `/nft-imgs/solar_2222px_39.00px_%23${color.colore.substring(1).toUpperCase()}_lvl${selectedLevel}_n${color.id}.png`;
    nDiv.innerHTML = `#${color.id}/108`;
    colorBoxDiv.style.backgroundColor = color.colore;
    colorNameText.innerHTML = color.nome;
    colorMeaningDiv.innerHTML = color.descrizione.replace(/\n/g, "<br>");


    const tarocchiUnaParola = [
      "Creatività",   // Il Matto
      "Nuovo Inizio", // Il Mago
      "Saggezza",   // La Papessa
      "Fertilità",  // L'Imperatrice
      "Potere",     // L'Imperatore
      "Spiritualità", // Il Papa
      "Scelta",     // Gli Amanti
      "Vittoria",   // Il Carro
      "Coraggio",   // La Forza
      "Introspezione", // L'Eremita
      "Cambiamento", // La Ruota della Fortuna
      "Equilibrio",  // La Giustizia
      "Riflessione", // L'Appeso
      "Trasformazione", // La Morte
      "Armonia",    // La Temperanza
      "Tentazione", // Il Diavolo
      "Distruzione", // La Torre
      "Speranza",   // La Stella
      "Illusione",  // La Luna
      "Gioia",      // Il Sole
      "Resurrezione", // Il Giudizio
      "Completezza"  // Il Mondo
    ];

    const arcaniMaggiori = [
        "Il Matto",
        "Il Mago",
        "La Papessa",
        "L'Imperatrice",
        "L'Imperatore",
        "Il Papa",
        "Gli Amanti",
        "Il Carro",
        "La Forza",
        "L'Eremita",
        "La Ruota della Fortuna",
        "La Giustizia",
        "L'Appeso",
        "La Carta Senza Nome",
        "La Temperanza",
        "Il Diavolo",
        "La Torre",
        "La Stella",
        "La Luna",
        "Il Sole",
        "Il Giudizio",
        "Il Mondo"
      ];


    containerLivello.innerHTML = `
      <div><img class="tarocco" src="/tarocchi-marsigliesi/${selectedLevel%22}.jpeg"></div>
      <div class="inner">
        <div class="titolo">
          Profondità ${selectedLevel}
        </div>
        <p class="sottotitolo">
          ${tarocchiUnaParola[selectedLevel%22]}
        </p>
        <div class="contenuto">
          ${levelDescription}
        </div>
      </div>

    `;
}

// Funzione per filtrare i colori per categoria
function filterColors() {
    const selectedCategory = document.getElementById('category-filter').value;
    const selectedLevel = document.getElementById('level-filter').value;

    let filteredColors = colorsData;

    if (selectedCategory) {
        filteredColors = filteredColors.filter(color => color.categoria === selectedCategory);
    }

    //displayLevelDescription(selectedLevel);

    loadColors(filteredColors);
}


// Funzione per caricare dinamicamente le opzioni dei livelli
function loadLevelOptions() {
    const levelFilter = document.getElementById('level-filter');

    // Aggiungi le opzioni per i livelli da 1 a 22
    for (let i = 1; i <= 22; i++) {
        const option = document.createElement('option');
        option.value = i;
        option.textContent = `Profondità ${i}`;
        levelFilter.appendChild(option);
    }
    levelFilter.value = 22;
}

// Chiama la funzione per caricare le opzioni
loadLevelOptions();

// Funzione per mostrare la descrizione del livello
function getLevelDescription(level) {
  return levelsDescription[level] ? levelsDescription[level][language] : '';
}

// Funzione per cambiare la lingua
function changeLanguage() {
    language = document.getElementById('language-select').value;
    filterColors(); // Ricarica i colori e descrizioni in base alla lingua
}

// Seleziona l'elemento sticky
var stickyElement = document.querySelector('.sticky-element');

// Aggiungi un listener per il comportamento sticky
window.addEventListener('scroll', function() {
  // Verifica se l'elemento è diventato sticky
  if (stickyElement.getBoundingClientRect().top <= 0) {
    stickyElement.classList.add('sticky');
  } else {
    stickyElement.classList.remove('sticky');
  }
});
