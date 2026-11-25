// El cuaderno de palabras: guarda las palabras en inglés que Bobby ha enseñado (el motor avisa de cada una
// con el evento `palabra`). Al tocar el cuaderno se abre, y al tocar una palabra se oye en inglés y en español.
//
// Es lo único de la interfaz que lleva texto: sirve para repasar con una persona adulta. El juego no lo necesita.

import { crear, crearDibujoDeCosa, decirConVoz } from './elementos.ts';

export interface Palabra {
  readonly en: string;
  readonly es: string;
}

export interface CuadernoDePalabras {
  agregar(palabra: Palabra): void;
  /** Las palabras vistas hasta ahora, en el orden en que aparecieron. */
  readonly palabras: readonly Palabra[];
}

const CLAVE_DE_LAS_PALABRAS = 'pardalis:escenario-uno:palabras';

export function crearCuadernoDePalabras(padre: HTMLElement): CuadernoDePalabras {
  const palabras: Palabra[] = leerPalabrasGuardadas();

  const boton = crear('button', 'hud-cuaderno', padre);
  boton.type = 'button';
  boton.setAttribute('aria-label', 'Mis palabras en inglés');
  crear('span', 'hud-cuaderno-letras', boton).textContent = 'Abc';
  const cuenta = crear('span', 'hud-cuaderno-cuenta', boton);

  const panel = crear('div', 'hud-palabras', padre);
  panel.hidden = true;
  const lista = crear('div', 'hud-palabras-lista', panel);

  boton.addEventListener('click', () => {
    panel.hidden = !panel.hidden;
  });

  const pintar = (): void => {
    cuenta.textContent = String(palabras.length);
    lista.replaceChildren();
    for (const palabra of palabras) {
      lista.append(crearFichaDePalabra(palabra));
    }
  };
  pintar();

  return {
    palabras,
    agregar(palabra) {
      const yaEstaba = palabras.some((vista) => vista.en === palabra.en);
      if (yaEstaba) return;
      palabras.push(palabra);
      guardarPalabras(palabras);
      pintar();
      boton.classList.remove('hud-brinco');
      // Leer el ancho hace que el navegador note el cambio de clase y la animación vuelva a empezar.
      void boton.offsetWidth;
      boton.classList.add('hud-brinco');
    },
  };
}

/** Una ficha con la palabra en inglés y en español. Al tocarla se oyen las dos. */
export function crearFichaDePalabra(palabra: Palabra): HTMLButtonElement {
  const ficha = crear('button', 'hud-ficha');
  ficha.type = 'button';
  crear('span', 'hud-ficha-en', ficha).textContent = palabra.en;
  crear('span', 'hud-ficha-es', ficha).textContent = palabra.es;
  ficha.addEventListener('click', () => {
    decirConVoz(palabra.en, 'en');
    decirConVoz(palabra.es, 'es');
  });
  return ficha;
}

/** Olvida las palabras guardadas: se usa al terminar la aventura, para que la siguiente empiece limpia. */
export function borrarPalabrasGuardadas(): void {
  try {
    localStorage.removeItem(CLAVE_DE_LAS_PALABRAS);
  } catch (error) {
    console.warn('[escenario-uno] no se pudieron borrar las palabras guardadas:', error);
  }
}

function guardarPalabras(palabras: readonly Palabra[]): void {
  try {
    localStorage.setItem(CLAVE_DE_LAS_PALABRAS, JSON.stringify(palabras));
  } catch (error) {
    console.warn('[escenario-uno] no se pudieron guardar las palabras:', error);
  }
}

function leerPalabrasGuardadas(): Palabra[] {
  const palabras: Palabra[] = [];
  let guardadas: unknown;
  try {
    guardadas = JSON.parse(localStorage.getItem(CLAVE_DE_LAS_PALABRAS) ?? '[]');
  } catch (error) {
    console.warn('[escenario-uno] no se pudieron leer las palabras guardadas:', error);
    return palabras;
  }
  if (!Array.isArray(guardadas)) return palabras;

  for (const guardada of guardadas) {
    // Lo guardado viene de afuera: solo se aceptan las entradas con la forma esperada.
    if (typeof guardada !== 'object' || guardada === null) continue;
    if (typeof guardada.en !== 'string' || typeof guardada.es !== 'string') continue;
    palabras.push({ en: guardada.en, es: guardada.es });
  }
  return palabras;
}

/** El dibujo de una estrella, para la pantalla del final. */
export function crearEstrella(padre: HTMLElement): HTMLImageElement {
  return crearDibujoDeCosa('item_estrella', 'hud-estrella', padre);
}
