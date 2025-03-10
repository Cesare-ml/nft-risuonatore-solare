/*
function calcolaLuminosita(hex) {
    // Rimuove il simbolo "#" se presente
    hex = hex.replace("#", "");

    // Ottieni i valori RGB
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);

    // Calcola la luminosità usando la formula
    return 0.299 * r + 0.587 * g + 0.114 * b;
}
// Funzione per convertire un colore esadecimale in RGB
function hexToRgb(hex) {
let r = 0, g = 0, b = 0;

// Rimuove il simbolo '#' all'inizio
hex = hex.replace(/^#/, '');

// Se è un formato breve (es. #FFF), lo espande a 6 caratteri
if (hex.length === 3) {
hex = hex.split('').map(function (hex) {
    return hex + hex;
}).join('');
}

// Ottieni i valori RGB
r = parseInt(hex.substring(0, 2), 16);
g = parseInt(hex.substring(2, 4), 16);
b = parseInt(hex.substring(4, 6), 16);

return { r, g, b };
}

// Funzione per convertire RGB in HSL e restituire la luminosità (lightness)
function rgbToHsl(r, g, b) {
r /= 255;
g /= 255;
b /= 255;

let max = Math.max(r, g, b);
let min = Math.min(r, g, b);
let h, s, l = (max + min) / 2;

if (max === min) {
h = s = 0; // Grigio, nessuna saturazione
} else {
let d = max - min;
s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
if (max === r) {
    h = (g - b) / d + (g < b ? 6 : 0);
} else if (max === g) {
    h = (b - r) / d + 2;
} else {
    h = (r - g) / d + 4;
}
h /= 6;
}

return { h, s, l }; // Restituisce la luminosità (l)
}

// Funzione per ottenere la luminosità di un colore esadecimale
function getLightness(hex) {
const rgb = hexToRgb(hex);
const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
return hsl.l; // Restituisce la luminosità
}*/



    // Ordinamento dei colori in base alla luminosità (dal più scuro al più chiaro)
    //colors.sort((a, b) => calcolaLuminosita(a.colore) - calcolaLuminosita(b.colore));

    // Ordinamento dei colori per categoria e sottocategoria
    /*
    colors.sort((a, b) => {
      // Ordinamento per categoria (prima Caldi, poi Freddi, poi gli altri)
     const ordineCategoria = {
         'Metalli': 0,
         'Caldi': 1,
         'Terrosi': 2,
         'Viola': 3,
         'Freddi': 4,
         'Verdi': 5,
         'Pastello': 6,
         'Altro': 7,
     };

     // Ordinamento per categoria
     if (ordineCategoria[a.categoria] < ordineCategoria[b.categoria]) return -1;
     if (ordineCategoria[a.categoria] > ordineCategoria[b.categoria]) return 1;
     // Ordinamento per sottocategoria (prima Oro, poi Argento, per Metalli)
      if (a.categoria === 'Metalli' && b.categoria === 'Metalli') {
          const ordineSottocategoriaMetalli = {
              'Oro': 1,
              'Argento': 2
          };
          if(a.nome == "Oro Puro" ) return -1;
          if(b.nome == "Oro Puro") return 1;
          if (ordineSottocategoriaMetalli[a.sottocategoria] < ordineSottocategoriaMetalli[b.sottocategoria]) return -1;
          if (ordineSottocategoriaMetalli[a.sottocategoria] > ordineSottocategoriaMetalli[b.sottocategoria]) return 1;
      }
      if (a.categoria === 'Caldi' && b.categoria === 'Caldi') {
          const ordineSottocategoriaMetalli = {
              'Gialli': 1,
              'Arancioni': 2,
              'Rossi': 3
          };
          if (ordineSottocategoriaMetalli[a.sottocategoria] < ordineSottocategoriaMetalli[b.sottocategoria]) return -1;
          if (ordineSottocategoriaMetalli[a.sottocategoria] > ordineSottocategoriaMetalli[b.sottocategoria]) return 1;
      }
      if (a.categoria === 'Viola' && b.categoria === 'Viola') {
          const ordineSottocategoriaMetalli = {
              'Viola Scuro': 1,
              'Indaco': 2
          };
          if (ordineSottocategoriaMetalli[a.sottocategoria] < ordineSottocategoriaMetalli[b.sottocategoria]) return -1;
          if (ordineSottocategoriaMetalli[a.sottocategoria] > ordineSottocategoriaMetalli[b.sottocategoria]) return 1;
      }
      if (a.categoria === 'Freddi' && b.categoria === 'Freddi') {
          const ordineSottocategoriaMetalli = {
              'Azzurri': 1,
              'Turchesi': 2,
              'Blu': 3
          };
          if (ordineSottocategoriaMetalli[a.sottocategoria] < ordineSottocategoriaMetalli[b.sottocategoria]) return -1;
          if (ordineSottocategoriaMetalli[a.sottocategoria] > ordineSottocategoriaMetalli[b.sottocategoria]) return 1;
      }

        // Se le categorie sono uguali, ordina per sottocategoria
        if (a.sottocategoria < b.sottocategoria) return -1;
        if (a.sottocategoria > b.sottocategoria) return 1;

        //return calcolaLuminosita(b.colore) - calcolaLuminosita(a.colore)
        const luminositaA = getLightness(a.colore);
        const luminositaB = getLightness(b.colore);

        if (luminositaA < luminositaB) return 1;
        if (luminositaA > luminositaB) return -1;

        return 0; // Se entrambe categoria e sottocategoria sono uguali
    });
*/
