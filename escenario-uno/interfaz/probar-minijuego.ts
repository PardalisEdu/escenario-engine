// Mesa de pruebas: abre un minijuego solo, sin recorrer el nivel.
//   http://localhost:3000/?minijuego=Balero
//   http://localhost:3000/?minijuego=Cobro&config={"precio":15,"compra":"item_tostadas"}
//
// Le arma al minijuego lo mismo que le daría el motor (imágenes, voz, sonidos y estado), pero de mentiras:
// el estado empieza con 100 pesos y, al terminar, el resultado se muestra en la pantalla.

import type { ContextoDeMinijuego, Minijuego, ValorDeEstado } from '../motor.ts';

/** Las carpetas de assets que usa el mercado, en el orden de su `nivel.json`. */
const CARPETAS_DE_ASSETS = ['/niveles/mercado/', '/niveles/comun/'];
const DINERO_DE_PRUEBA = 100;

export async function probarMinijuego(elemento: HTMLElement, minijuego: Minijuego, config: unknown): Promise<void> {
  const direcciones = await leerDireccionesDeLosAssets();
  const estado: Record<string, ValorDeEstado> = { dinero: DINERO_DE_PRUEBA };
  const cierre = new AbortController();

  const espacio = document.createElement('div');
  espacio.style.cssText = 'position:absolute; inset:0; display:grid;';
  const lugarDelMinijuego = document.createElement('div');
  lugarDelMinijuego.setAttribute('data-escenario-minijuego', '');
  espacio.append(lugarDelMinijuego);
  elemento.style.position = 'relative';
  elemento.append(espacio);

  const contexto: ContextoDeMinijuego = {
    elemento: lugarDelMinijuego,
    config,
    senal: cierre.signal,
    estado: {
      obtener: (nombre) => (Object.hasOwn(estado, nombre) ? estado[nombre] : undefined),
      cumple: (condicion) => Boolean(estado[condicion.replace(/^tengo /, '')]),
    },
    audio: {
      tocar(clave) {
        const direccion = direcciones.get(clave);
        if (direccion === undefined) {
          console.warn(`[prueba] no existe el sonido "${clave}"`);
          return;
        }
        void new Audio(direccion).play().catch(() => {});
      },
      decir(texto, idioma) {
        console.log(`[prueba] voz (${idioma}): ${texto}`);
        if (!('speechSynthesis' in window)) return;
        const frase = new SpeechSynthesisUtterance(texto);
        frase.lang = idioma === 'en' ? 'en-US' : 'es-MX';
        speechSynthesis.cancel();
        speechSynthesis.speak(frase);
      },
    },
    assets: {
      url(clave) {
        const direccion = direcciones.get(clave);
        if (direccion === undefined) {
          console.warn(`[prueba] no existe el asset "${clave}"`);
          return '';
        }
        return direccion;
      },
    },
  };

  let resultado: unknown;
  try {
    resultado = await minijuego(contexto);
  } catch (error) {
    resultado = { exito: false, error: String(error) };
    console.error(error);
  }
  cierre.abort();
  espacio.remove();

  const informe = document.createElement('pre');
  informe.id = 'resultado-de-la-prueba';
  informe.style.cssText = 'margin:0; padding:24px; color:#fff6e0; font:18px/1.5 ui-monospace, monospace; white-space:pre-wrap;';
  informe.textContent = `El minijuego terminó con:\n${JSON.stringify(resultado, null, 2)}\n\nRecarga la página para jugarlo otra vez.`;
  elemento.append(informe);
}

/** Lee los manifiestos `assets.json` y arma un diccionario de clave → dirección del archivo. */
async function leerDireccionesDeLosAssets(): Promise<Map<string, string>> {
  const direcciones = new Map<string, string>();
  for (const carpeta of CARPETAS_DE_ASSETS) {
    const respuesta = await fetch(`${carpeta}assets.json`);
    const manifiesto: unknown = await respuesta.json();
    if (typeof manifiesto !== 'object' || manifiesto === null) continue;

    for (const [clave, asset] of Object.entries(manifiesto)) {
      if (direcciones.has(clave)) continue; // gana la primera carpeta, igual que en el motor
      const archivo = leerArchivoDelAsset(asset);
      if (archivo !== undefined) {
        direcciones.set(clave, carpeta + archivo);
      }
    }
  }
  return direcciones;
}

/** El archivo de un asset del manifiesto; de una animación, su primer cuadro. */
function leerArchivoDelAsset(asset: unknown): string | undefined {
  if (typeof asset !== 'object' || asset === null) return undefined;
  if ('archivo' in asset && typeof asset.archivo === 'string') return asset.archivo;
  if ('cuadros' in asset && Array.isArray(asset.cuadros) && typeof asset.cuadros[0] === 'string') return asset.cuadros[0];
  return undefined;
}
