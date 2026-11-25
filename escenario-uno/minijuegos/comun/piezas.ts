// Piezas pequeñas que usan todos los minijuegos: crear elementos, poner imágenes del nivel, esperar y revolver.

import type { ContextoDeMinijuego } from '../../motor.ts';

/** Crea un elemento con su clase de CSS y, si se pide, lo mete dentro de `padre`. */
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

/** Una imagen de los assets del nivel (por su clave), que no se puede arrastrar ni seleccionar. */
export function crearImagen(contexto: ContextoDeMinijuego, clave: string, clase: string, padre?: HTMLElement): HTMLImageElement {
  const imagen = crear('img', clase, padre);
  imagen.src = contexto.assets.url(clave);
  imagen.alt = '';
  imagen.draggable = false;
  return imagen;
}

/** Un botón redondo que solo lleva un dibujo. `nombre` es lo que lee un lector de pantalla. */
export function crearBotonConDibujo(contexto: ContextoDeMinijuego, clave: string, nombre: string, padre?: HTMLElement): HTMLButtonElement {
  const boton = crear('button', 'mj-boton', padre);
  boton.type = 'button';
  boton.setAttribute('aria-label', nombre);
  crearImagen(contexto, clave, 'mj-boton-dibujo', boton);
  return boton;
}

/**
 * Una pausa. Termina sola al pasar el tiempo, o antes si el motor cierra el minijuego:
 * así ninguna pausa deja un temporizador vivo.
 */
export function esperar(milisegundos: number, senal: AbortSignal): Promise<void> {
  return new Promise((terminar) => {
    if (senal.aborted) {
      terminar();
      return;
    }
    const temporizador = setTimeout(() => {
      senal.removeEventListener('abort', alCerrar);
      terminar();
    }, milisegundos);
    const alCerrar = (): void => {
      clearTimeout(temporizador);
      terminar();
    };
    senal.addEventListener('abort', alCerrar, { once: true });
  });
}

/** Devuelve una copia de la lista en desorden. */
export function revolver<Cosa>(lista: readonly Cosa[]): Cosa[] {
  const copia = [...lista];
  for (let i = copia.length - 1; i > 0; i--) {
    const otro = Math.floor(Math.random() * (i + 1));
    const guardado = copia[i]!; // `i` y `otro` siempre están dentro de la lista
    copia[i] = copia[otro]!;
    copia[otro] = guardado;
  }
  return copia;
}

/** Un número entero al azar entre `minimo` y `maximo`, los dos incluidos. */
export function enteroAlAzar(minimo: number, maximo: number): number {
  return minimo + Math.floor(Math.random() * (maximo - minimo + 1));
}

/** Hace que un elemento repita una animación de CSS aunque ya la haya hecho antes. */
export function animar(elemento: HTMLElement, claseDeAnimacion: string): void {
  elemento.classList.remove(claseDeAnimacion);
  // Leer el ancho obliga al navegador a notar que la clase se quitó; sin esto la animación no vuelve a empezar.
  void elemento.offsetWidth;
  elemento.classList.add(claseDeAnimacion);
}

/** Lee un número de la configuración del nivel; si no viene o no sirve, usa el valor por defecto. */
export function leerNumero(config: unknown, nombre: string, porDefecto: number): number {
  if (typeof config !== 'object' || config === null || !Object.hasOwn(config, nombre)) return porDefecto;
  const valor = (config as Record<string, unknown>)[nombre]; // se acaba de comprobar que es un objeto con ese campo
  if (typeof valor !== 'number' || !Number.isFinite(valor) || valor < 0) return porDefecto;
  return valor;
}
