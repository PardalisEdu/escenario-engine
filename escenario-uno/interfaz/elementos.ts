// Ayudantes para armar los elementos de la interfaz del sitio (la lista, el monedero, el cuaderno, el final).

/** Carpeta donde están los dibujos de las cosas del mercado. */
const CARPETA_DE_COSAS = '/niveles/comun/img/cosas/';
const CARPETA_DE_PERSONAJES = '/niveles/comun/img/personajes/';

export function crear<Etiqueta extends keyof HTMLElementTagNameMap>(
  etiqueta: Etiqueta,
  clase: string,
  padre?: HTMLElement,
): HTMLElementTagNameMap[Etiqueta] {
  const elemento = document.createElement(etiqueta);
  elemento.className = clase;
  if (padre !== undefined) {
    padre.append(elemento);
  }
  return elemento;
}

/** El dibujo de una cosa del mercado, por su clave (`item_lechuga`). */
export function crearDibujoDeCosa(clave: string, clase: string, padre?: HTMLElement): HTMLImageElement {
  return crearDibujo(`${CARPETA_DE_COSAS}${clave}.svg`, clase, padre);
}

/** El dibujo de un personaje, por el nombre de su archivo (`pardi_feliz`). */
export function crearDibujoDePersonaje(archivo: string, clase: string, padre?: HTMLElement): HTMLImageElement {
  return crearDibujo(`${CARPETA_DE_PERSONAJES}${archivo}.svg`, clase, padre);
}

function crearDibujo(direccion: string, clase: string, padre?: HTMLElement): HTMLImageElement {
  const imagen = crear('img', clase, padre);
  imagen.src = direccion;
  imagen.alt = '';
  imagen.draggable = false;
  return imagen;
}

/** Dice una palabra con la voz del navegador, si el dispositivo tiene. */
export function decirConVoz(texto: string, idioma: 'es' | 'en'): void {
  if (!('speechSynthesis' in window)) return;
  const frase = new SpeechSynthesisUtterance(texto);
  frase.lang = idioma === 'en' ? 'en-US' : 'es-MX';
  speechSynthesis.speak(frase);
}
