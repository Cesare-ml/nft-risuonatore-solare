var colorsData = [];
var levelsDescription = [];
var selectedNFT = 0;
var language = 'it';  // Default language

// Carica il file JSON
fetch('/assets/json/nft-colors.json?timestamp=' + new Date().getTime())
    .then(response => response.json())
    .then(colorsD => {
        colorsData = colorsD;
        loadColors(colorsData);
        loadNFT(1);
    })
    .catch(error => {
        console.error('Errore nel caricamento del file JSON:', error);
    });


// Funzione per caricare i colori nella pagina
function loadColors(colors) {
    const container = document.getElementById('color-list');
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

// Funzione per generare il colore complementare
function getComplementaryColor(hexColor) {
    let r = parseInt(hexColor.substring(1, 3), 16);
    let g = parseInt(hexColor.substring(3, 5), 16);
    let b = parseInt(hexColor.substring(5, 7), 16);

    r = 255 - r;
    g = 255 - g;
    b = 255 - b;

    const rHex = r.toString(16).padStart(2, '0');
    const gHex = g.toString(16).padStart(2, '0');
    const bHex = b.toString(16).padStart(2, '0');

    return `#${rHex}${gHex}${bHex}`;
}

function loadNFT(id) {
    selectedNFT = id;

    const container = document.getElementById('nft-dettagli');

    const color = colorsData[id-1];

    //var imgTag = container.getElementsByTagName("img")[0];
    var nDiv = container.getElementsByClassName("n")[0];
    var colorBoxDiv = container.getElementsByClassName("color-box")[0];
    var colorNameText = container.getElementsByClassName("color-name")[0].getElementsByClassName("text")[0];
    var colorMeaningDiv = container.getElementsByClassName("color-meaning")[0];

    //imgTag.src = `/nft-imgs/solar_2222px_39.00px_%23${color.colore.substring(1).toUpperCase()}_lvl${selectedLevel}_n${color.id}.png`;
    nDiv.innerHTML = `#${color.id}/108`;
    colorBoxDiv.style.backgroundColor = color.colore;
    colorNameText.innerHTML = color.nome;
    colorMeaningDiv.innerHTML = color.descrizione.replace(/\n/g, "<br>");

    var bgSource = `/nft-imgs/solar_2222px_39.00px_%23${color.colore.substring(1).toUpperCase()}_lvl22_n${color.id}.png`;

    loadHeart(bgSource,color.colore, getComplementaryColor(color.colore));
}

function darkenHex(hex, factor) {
    // Assicurati che il colore esadecimale inizi con '#'
    if (hex.startsWith('#')) {
        hex = hex.slice(1); // Rimuove il '#' iniziale
    }

    // Se il colore esadecimale ha 3 caratteri, espandilo a 6
    if (hex.length === 3) {
        hex = hex.split('').map(char => char + char).join('');
    }

    // Converte il colore esadecimale in valori RGB
    let r = parseInt(hex.substring(0, 2), 16);
    let g = parseInt(hex.substring(2, 4), 16);
    let b = parseInt(hex.substring(4, 6), 16);

    // Applica il fattore di scurimento
    r = Math.max(0, Math.min(255, r * factor));
    g = Math.max(0, Math.min(255, g * factor));
    b = Math.max(0, Math.min(255, b * factor));

    // Ritorna il colore esadecimale più scuro
    return `#${(1 << 24 | (r << 16) | (g << 8) | b).toString(16).slice(1).toUpperCase()}`;
}

function loadHeart(bgSource, colorA, colorB) {
    fetch('/assets/svg/heart-nft.svg')
        .then(response => response.text())
        .then(svgText => {
            const parser = new DOMParser();
            const svgDoc = parser.parseFromString(svgText, "image/svg+xml").documentElement;

            // Aggiorna il primo colore dei gradienti (linearGradient e radialGradient)
            svgDoc.querySelectorAll('linearGradient, radialGradient').forEach(gradient => {
                // Seleziona i stop all'interno del gradiente
                const stops = gradient.querySelectorAll('stop');

                stops.forEach((stop, index) => {
                    // Cambia il primo colore (offset=0) dei gradienti
                    if (index === 0) {
                        if (gradient.id === 'gradient-2' || gradient.id === 'gradient-4' || gradient.id === 'gradient-6' || gradient.id === 'gradient-8') {
                            stop.setAttribute('style', `stop-color: ${colorA}`);
                        } else if (gradient.id === 'gradient-0' || gradient.id === 'gradient-5' || gradient.id === 'gradient-7') {
                            stop.setAttribute('style', `stop-color: ${colorB}`);
                        }
                    }
                    // Cambia il secondo colore (offset=1) dei gradienti
                    if (index === 1) {
                        if (gradient.id === 'gradient-2' || gradient.id === 'gradient-4' || gradient.id === 'gradient-6' || gradient.id === 'gradient-8') {
                            stop.setAttribute('style', `stop-color: ${darkenHex(colorA, 0.48)}`);
                        } else if (gradient.id === 'gradient-0' || gradient.id === 'gradient-5' || gradient.id === 'gradient-7') {
                            stop.setAttribute('style', `stop-color: ${darkenHex(colorB, 0.48)}`);
                        }
                    }
                });
            });

            // Sostituire il src dell'immagine
            const imageElement = svgDoc.querySelector('image');
            if (imageElement) {
                imageElement.setAttribute('href', bgSource); // Cambia il percorso dell'immagine
            }

            // Rimuove l'SVG precedente se esiste
            const container = document.getElementById("svg-container");
            container.innerHTML = ""; // Pulisce il contenitore

            // Aggiungi il nuovo SVG al contenitore
            container.appendChild(svgDoc);
        })
        .catch(error => console.error("Errore nel caricamento dell'SVG:", error));
}


// Funzione per filtrare i colori per categoria
function filterColors() {
    const selectedCategory = document.getElementById('category-filter').value;

    let filteredColors = colorsData;

    if (selectedCategory) {
        filteredColors = filteredColors.filter(color => color.categoria === selectedCategory);
    }

    //displayLevelDescription(selectedLevel);

    loadColors(filteredColors);
}



// Funzione per cambiare la lingua
function changeLanguage() {
    language = document.getElementById('language-select').value;
    filterColors(); // Ricarica i colori e descrizioni in base alla lingua
}
/*
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
});*/

// 📦 Scarica un blob come file
function downloadBlob(blob, filename) {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
}

function serializeSvg(svg) {
  const serializer = new XMLSerializer()
  return serializer.serializeToString(svg)
}

// 🔁 Ridimensiona SVG a 2222px larghezza
function resizeSvg(svg) {
  const copy = svg.cloneNode(true)

  let viewBox = copy.viewBox.baseVal
  let originalWidth = viewBox?.width || copy.width.baseVal.value
  let originalHeight = viewBox?.height || copy.height.baseVal.value

  const newWidth = 4444
  const newHeight = originalHeight * (newWidth / originalWidth)

  console.log(newWidth);
  copy.setAttribute('width', newWidth)
  copy.setAttribute('height', newHeight)

  return { svg: copy, width: newWidth, height: newHeight }
}

// 🧠 Clona SVG e incorpora immagini
async function prepareInlineSvg(svg, removeImages = false) {
  const { svg: copy } = resizeSvg(svg)

  if (removeImages) {
    copy.querySelectorAll('image').forEach(el => el.remove())
  } else {
    const imageElements = copy.querySelectorAll('image')

    await Promise.all(Array.from(imageElements).map(async (imgEl) => {
      const href = imgEl.getAttribute('href') || imgEl.getAttributeNS('http://www.w3.org/1999/xlink', 'href')
      if (!href || href.startsWith('data:')) return

      try {
        const res = await fetch(href)
        const blob = await res.blob()
        const reader = new FileReader()

        await new Promise(resolve => {
          reader.onload = () => {
            imgEl.setAttribute('href', reader.result)
            resolve()
          }
          reader.readAsDataURL(blob)
        })
      } catch (err) {
        console.warn('Errore nel caricare immagine esterna:', href, err)
      }
    }))
  }

  return copy
}

// 📤 SVG → PNG con resize a 2222px larghezza
async function svgToPng(originalSvg, transparent = false) {
  const preparedSvg = await prepareInlineSvg(originalSvg, transparent)
  const { svg: resizedSvg, width, height } = resizeSvg(preparedSvg)
  const svgData = serializeSvg(resizedSvg)
  const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' })
  const url = URL.createObjectURL(svgBlob)

  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')

      if (!transparent) {
        ctx.fillStyle = 'white'
        ctx.fillRect(0, 0, canvas.width, canvas.height)
      }

      ctx.drawImage(img, 0, 0)
      canvas.toBlob(blob => {
        resolve(blob)
        URL.revokeObjectURL(url)
      }, 'image/png')
    }
    img.src = url
  })
}

// 💾 Scarica SVG (con immagini incorporate + resize)
document.getElementById('download-svg').addEventListener('click', async () => {
  const svg = document.querySelector('svg')
  const preparedSvg = await prepareInlineSvg(svg)
  const { svg: resizedSvg } = resizeSvg(preparedSvg)
  const svgData = serializeSvg(resizedSvg)
  const blob = new Blob([svgData], { type: 'image/svg+xml' })

  const name = 'heart #' + selectedNFT + '_108 ' + colorsData[selectedNFT - 1].nome + '.svg'
  downloadBlob(blob, name)
})

// 💾 Scarica PNG
document.getElementById('download-png').addEventListener('click', async () => {
  const svg = document.querySelector('svg')
  const blob = await svgToPng(svg, false)

  const name = 'heart #' + selectedNFT + '_108 ' + colorsData[selectedNFT - 1].nome + '.png'
  downloadBlob(blob, name)
})

// 💾 Scarica PNG trasparente
document.getElementById('download-transparent-png').addEventListener('click', async () => {
  const svg = document.querySelector('svg')
  const blob = await svgToPng(svg, true)

  const name = 'heart #' + selectedNFT + '_108 ' + colorsData[selectedNFT - 1].nome + '_trasparente.png'
  downloadBlob(blob, name)
})
