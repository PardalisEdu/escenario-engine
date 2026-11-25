// La charola donde Doña Tepo pone el cambio. Cada moneda es un botón: al tocarla se suma a la cuenta
// y la voz dice cuánto va («diez… quince»). Un letrero enseña la cuenta con números.

import type { Marco } from '../comun/marco.ts';
import { numeroEnEspanol } from '../comun/numeros.ts';
import { animar, crear, crearImagen, esperar } from '../comun/piezas.ts';
import { claveDelDibujoDeLaPieza, esBillete } from './piezas-del-cambio.ts';
import type { VozEnDosIdiomas } from './voz-en-dos-idiomas.ts';

/** Al contar sola, el tiempo entre una moneda y la siguiente (alcanza para oír el número). */
const PAUSA_ENTRE_PIEZAS_AL_CONTAR_EN_MILISEGUNDOS = 1100;

interface PiezaEnLaCharola {
  readonly valor: number;
  readonly boton: HTMLButtonElement;
}

export interface Charola {
  /** Doña Tepo pone una moneda o billete de ese valor. */
  ponerPieza(valor: number): void;
  /** Cuenta todo desde cero, moneda por moneda y en voz alta. Mientras cuenta, los toques no hacen nada. */
  contarTodoEnVozAlta(): Promise<void>;
  /** Se pinta de «ya está completo» y deja de responder a los toques. */
  marcarComoCompleta(): void;
}

export function crearCharola(marco: Marco, voz: VozEnDosIdiomas, padre: HTMLElement): Charola {
  const elemento = crear('div', 'verduleria-charola', padre);
  const lugarDeLasPiezas = crear('div', 'verduleria-charola-piezas', elemento);
  const letrero = crear('div', 'verduleria-charola-cuenta', elemento);
  letrero.textContent = '$0';

  const piezas: PiezaEnLaCharola[] = [];
  let totalContado = 0;
  let respondeALosToques = true;

  function empezarLaCuentaDeNuevo(): void {
    totalContado = 0;
    for (const pieza of piezas) {
      pieza.boton.classList.remove('verduleria-pieza-contada');
    }
  }

  /** Suma una pieza a la cuenta y dice cuánto va. Si ya estaba contada, la cuenta empieza otra vez con ella. */
  function contar(pieza: PiezaEnLaCharola): void {
    if (pieza.boton.classList.contains('verduleria-pieza-contada')) {
      empezarLaCuentaDeNuevo();
    }
    pieza.boton.classList.add('verduleria-pieza-contada');
    totalContado += pieza.valor;
    letrero.textContent = `$${totalContado}`;
    animar(letrero, 'mj-brinco');
    marco.sonar('sfx_moneda');
    voz.decir(numeroEnEspanol(totalContado));
  }

  return {
    ponerPieza(valor) {
      const boton = crear('button', 'verduleria-pieza verduleria-llega', lugarDeLasPiezas);
      boton.type = 'button';
      boton.setAttribute('aria-label', `Contar ${numeroEnEspanol(valor)} pesos`);
      boton.classList.toggle('verduleria-pieza-billete', esBillete(valor));
      crearImagen(marco.contexto, claveDelDibujoDeLaPieza(valor), 'verduleria-pieza-dibujo', boton);

      const pieza: PiezaEnLaCharola = { valor, boton };
      piezas.push(pieza);
      boton.addEventListener(
        'click',
        () => {
          if (!respondeALosToques) return;
          contar(pieza);
        },
        { signal: marco.senal },
      );
    },
    async contarTodoEnVozAlta() {
      respondeALosToques = false;
      empezarLaCuentaDeNuevo();
      for (const pieza of piezas) {
        if (marco.senal.aborted) return;
        contar(pieza);
        await esperar(PAUSA_ENTRE_PIEZAS_AL_CONTAR_EN_MILISEGUNDOS, marco.senal);
      }
    },
    marcarComoCompleta() {
      respondeALosToques = false;
      elemento.classList.add('verduleria-charola-completa');
      animar(elemento, 'mj-brinco');
    },
  };
}
