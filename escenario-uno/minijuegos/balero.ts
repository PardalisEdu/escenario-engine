// Minijuego «Balero»: el puesto de Don Guajo, el guajolote. Reta a Pardi al balero:
// si lo ensarta las veces que pide, le regala el maíz.
//
// Se juega con un solo toque: el barrilito se mece bajo el palito y, al tocar la pantalla (o espacio o Enter),
// brinca. Si iba cerca del centro (la franja de luz), se ensarta. Las piezas están en la carpeta balero/.
//
// Nunca castiga: fallar solo provoca un rebote chistoso y ánimos de Don Guajo; lo ganado no se pierde.
//
// Configuración que le pasa el nivel:
//   { "aciertos": 5 }

import type { Minijuego } from '../motor.ts';
import { crearContador } from './balero/contador.ts';
import { crearJuguete, TOLERANCIA_EN_GRADOS } from './balero/juguete.ts';
import type { Juguete } from './balero/juguete.ts';
import { mecerHastaElToque } from './balero/pendulo.ts';
import { crearPersonaje } from './balero/personaje.ts';
import type { Personaje } from './balero/personaje.ts';
import { caerDelRebote, ensartar, ladoDelAngulo, soltarDelPalito, subirSinAtinar } from './balero/saltos.ts';
import { abrirMarco } from './comun/marco.ts';
import type { Marco } from './comun/marco.ts';
import { numeroEnEspanol, numeroEnIngles } from './comun/numeros.ts';
import { crear, esperar, leerNumero } from './comun/piezas.ts';
import { armarPremio, mostrarResultado } from './comun/resultado.ts';

const ACIERTOS_POR_DEFECTO = 5;
/** Más marcas que estas no caben en la fila del contador de un teléfono. */
const ACIERTOS_MAXIMOS = 8;
/** Lo que tarda el barrilito en ir y volver al principio. Con cada acierto se mece un poquito más rápido. */
const PERIODO_INICIAL_EN_MILISEGUNDOS = 2600;
const LO_QUE_QUEDA_DEL_PERIODO_CON_CADA_ACIERTO = 0.95;
const PERIODO_MINIMO_EN_MILISEGUNDOS = 1900;
const PAUSA_CON_EL_BALERO_ENSARTADO_EN_MILISEGUNDOS = 1100;
const PAUSA_ANTES_DEL_FINAL_EN_MILISEGUNDOS = 1300;
/** Con tan pocos fallos se ganan las tres estrellas, o las dos. */
const FALLOS_PARA_TRES_ESTRELLAS = 2;
const FALLOS_PARA_DOS_ESTRELLAS = 6;

const ANIMOS_DE_DON_GUAJO = ['¡Casi! ¡Otra vez!', '¡Glu, glu! ¡Tú puedes!', '¡Uy, por poquito!'];

/** Las piezas de la pantalla que el juego va moviendo. */
interface Puesto {
  readonly marco: Marco;
  readonly juguete: Juguete;
  readonly guajo: Personaje;
  readonly bobby: Personaje;
}

export const Balero: Minijuego = (contexto) => {
  const { marco, resultado } = abrirMarco(contexto, 'rojo');
  const meta = leerMeta(contexto.config);

  void jugar();
  return resultado;

  async function jugar(): Promise<void> {
    const escena = crear('div', 'balero-pantalla', marco.area);
    const contador = crearContador(marco, escena, meta);
    const guajo = crearPersonaje(marco, escena, { reposo: 'spr_guajo', gesto: 'guajo_habla', clase: 'balero-guajo' });
    const juguete = crearJuguete(escena);
    const bobby = crearPersonaje(marco, escena, { reposo: 'spr_bobby', gesto: 'bobby_feliz', clase: 'balero-bobby' });
    const puesto: Puesto = { marco, juguete, guajo, bobby };

    marco.indicar(`¡Ensarta el balero ${numeroEnEspanol(meta)} veces! Toca cuando pase por la luz.`, ['item_balero', 'item_maiz']);
    void guajo.gesticular();

    let aciertos = 0;
    let fallos = 0;
    let lado = 1;
    while (aciertos < meta) {
      const angulo = await mecerHastaElToque(juguete, {
        lado,
        periodoEnMilisegundos: periodoSegunLosAciertos(aciertos),
        zonaDeToque: marco.area,
        senal: marco.senal,
      });
      if (marco.senal.aborted) return;

      const leAtino = Math.abs(angulo) <= TOLERANCIA_EN_GRADOS;
      if (!leAtino) {
        fallos += 1;
        lado = await fallar(puesto, angulo, fallos);
        continue;
      }
      aciertos += 1;
      contador.llenarSiguiente();
      await acertar(puesto, angulo, aciertos);
      if (aciertos < meta) {
        // Se suelta hacia el otro lado cada vez, para que no siempre venga del mismo.
        lado = -lado;
        await soltarDelPalito(juguete, lado, marco.senal);
      }
    }
    if (marco.senal.aborted) return;

    await esperar(PAUSA_ANTES_DEL_FINAL_EN_MILISEGUNDOS, marco.senal);
    void guajo.gesticular();
    const estrellas = contarEstrellas(fallos);
    await mostrarResultado(marco, { estrellas, cosas: ['item_maiz'], frase: '¡Me ganaste! El maíz es tuyo.' });
    // El maíz es regalo: por eso el precio es cero y no se descuenta dinero.
    marco.terminar({ exito: true, otorgar: armarPremio(marco, { loPropio: { maiz: true }, precio: 0, estrellas }) });
  }
};

/** El barrilito se ensarta: suena, el dibujo brinca y Bobby cuenta en inglés. */
async function acertar(puesto: Puesto, anguloEnGrados: number, aciertos: number): Promise<void> {
  const { marco, juguete, bobby } = puesto;
  await ensartar(juguete, anguloEnGrados, marco.senal);
  if (marco.senal.aborted) return;
  marco.sonar('sfx_toc');
  marco.sonar('sfx_bien');
  juguete.animar('balero-juguete-ensartado');
  marco.decir(`${numeroEnIngles(aciertos)}!`, 'en');
  void bobby.gesticular();
  await esperar(PAUSA_CON_EL_BALERO_ENSARTADO_EN_MILISEGUNDOS, marco.senal);
}

/**
 * El barrilito no le atina: rebota chistoso y Don Guajo anima. Devuelve de qué lado quedó colgando
 * (1 = derecha, -1 = izquierda), para mecerlo otra vez desde ahí.
 */
async function fallar(puesto: Puesto, anguloEnGrados: number, fallos: number): Promise<number> {
  const { marco, juguete, guajo } = puesto;
  const lado = ladoDelAngulo(anguloEnGrados);
  await subirSinAtinar(juguete, anguloEnGrados, marco.senal);
  if (marco.senal.aborted) return lado;
  marco.sonar('sfx_no');
  juguete.animar('balero-juguete-golpeado');
  // Los ánimos se van turnando; el resto de la división da la vuelta a la lista.
  const animo = ANIMOS_DE_DON_GUAJO[(fallos - 1) % ANIMOS_DE_DON_GUAJO.length]!; // el resto siempre cae dentro de la lista
  marco.decir(animo);
  void guajo.gesticular();
  await caerDelRebote(juguete, lado, marco.senal);
  return lado;
}

function periodoSegunLosAciertos(aciertos: number): number {
  const periodo = PERIODO_INICIAL_EN_MILISEGUNDOS * LO_QUE_QUEDA_DEL_PERIODO_CON_CADA_ACIERTO ** aciertos;
  return Math.max(PERIODO_MINIMO_EN_MILISEGUNDOS, periodo);
}

/** Cuántas veces hay que ensartarlo. `config` viene del nivel: se revisa que sea un entero razonable. */
function leerMeta(config: unknown): number {
  const pedidos = Math.round(leerNumero(config, 'aciertos', ACIERTOS_POR_DEFECTO));
  return Math.min(ACIERTOS_MAXIMOS, Math.max(1, pedidos));
}

/** De 1 a 3 estrellas según los intentos fallados. Una estrella también es una felicitación. */
function contarEstrellas(fallos: number): number {
  if (fallos <= FALLOS_PARA_TRES_ESTRELLAS) return 3;
  if (fallos <= FALLOS_PARA_DOS_ESTRELLAS) return 2;
  return 1;
}
