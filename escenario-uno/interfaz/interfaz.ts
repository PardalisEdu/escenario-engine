// La interfaz del sitio, encima del juego: la lista del mandado, el monedero, las estrellas, el cuaderno
// de palabras y la pantalla del final. El motor no dibuja nada de esto: solo avisa con eventos.
//
// Se ve solo en el mercado, y se esconde durante las cinemáticas y los minijuegos para no estorbar.

import { borrarPalabrasGuardadas, crearCuadernoDePalabras } from './cuaderno-de-palabras.ts';
import { crear, crearDibujoDeCosa } from './elementos.ts';
import { leerEstadoDelMercado, NIVEL_DEL_MERCADO } from './estado-del-mercado.ts';
import { crearListaDelMandado } from './lista-del-mandado.ts';
import { mostrarPantallaDelFinal } from './pantalla-del-final.ts';
import type { Juego } from '../motor.ts';

/**
 * Cada cuánto se vuelve a leer la partida. El motor avisa cuando se cumple un objetivo, pero no cuando
 * cambia el dinero o las estrellas; por eso se revisa seguido.
 */
const PAUSA_ENTRE_LECTURAS_EN_MILISEGUNDOS = 500;

export interface Interfaz {
  /** Esconde o muestra el tablero. Lo usan los minijuegos, que ocupan toda la pantalla. */
  esconderPorMinijuego(escondido: boolean): void;
  mostrarElFinal(): void;
  destruir(): void;
}

export function crearInterfaz(elemento: HTMLElement, juego: Juego): Interfaz {
  const tablero = crear('div', 'hud', elemento);
  const lista = crearListaDelMandado(tablero);

  const derecha = crear('div', 'hud-derecha', tablero);
  const monedero = crear('div', 'hud-pastilla', derecha);
  crearDibujoDeCosa('item_moneda10', 'hud-pastilla-dibujo', monedero);
  const dinero = crear('span', 'hud-pastilla-numero', monedero);
  const estrellero = crear('div', 'hud-pastilla', derecha);
  crearDibujoDeCosa('item_estrella', 'hud-pastilla-dibujo', estrellero);
  const estrellas = crear('span', 'hud-pastilla-numero', estrellero);
  const cuaderno = crearCuadernoDePalabras(derecha);

  let hayCinematica = false;
  let hayMinijuego = false;
  let dineroMostrado = -1;

  const actualizar = (): void => {
    const seVe = juego.nivel === NIVEL_DEL_MERCADO && !hayCinematica && !hayMinijuego;
    tablero.classList.toggle('hud-escondido', !seVe);

    const estado = leerEstadoDelMercado(juego);
    lista.actualizar(estado.conseguido);
    estrellas.textContent = String(estado.estrellas);
    if (estado.dinero !== dineroMostrado) {
      dinero.textContent = `$${estado.dinero}`;
      // El monedero da un brinquito cuando cambia, menos la primera vez que se pinta.
      if (dineroMostrado !== -1) {
        monedero.classList.remove('hud-brinco');
        void monedero.offsetWidth; // hace que la animación vuelva a empezar
        monedero.classList.add('hud-brinco');
      }
      dineroMostrado = estado.dinero;
    }
  };

  const dejarDeEscuchar = [
    juego.on('cinematica', (cinematica) => {
      hayCinematica = cinematica.fase === 'inicio';
      actualizar();
    }),
    juego.on('nivel', actualizar),
    juego.on('objetivo', actualizar),
    juego.on('palabra', (palabra) => cuaderno.agregar(palabra)),
  ];
  const reloj = setInterval(actualizar, PAUSA_ENTRE_LECTURAS_EN_MILISEGUNDOS);
  actualizar();

  return {
    esconderPorMinijuego(escondido) {
      hayMinijuego = escondido;
      actualizar();
    },
    mostrarElFinal() {
      tablero.classList.add('hud-escondido');
      mostrarPantallaDelFinal(elemento, {
        estrellas: leerEstadoDelMercado(juego).estrellas,
        palabras: cuaderno.palabras,
        alJugarOtraVez: () => {
          borrarPalabrasGuardadas();
          // Empezar de nuevo es recargar la página sin partida guardada (ya se borró al llegar al final).
          location.assign(location.pathname);
        },
      });
    },
    destruir() {
      clearInterval(reloj);
      for (const dejar of dejarDeEscuchar) {
        dejar();
      }
      tablero.remove();
    },
  };
}
