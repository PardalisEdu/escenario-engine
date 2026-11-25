// Minijuego «Cartas»: la carpa de Madame Lula, la tecolota vidente. Lee el futuro con sus cartas
// y SIEMPRE dice cosas bonitas: no hay cartas malas.
//
// 1. Se paga la lectura contando monedas.
// 2. Sobre la mesa hay tres cartas boca abajo. Al tocar una, se voltea y enseña un símbolo; Madame Lula dice
//    la fortuna y Bobby dice el símbolo en inglés. Las otras dos también se pueden voltear por curiosidad.
//    Después de la primera aparece la palomita para seguir.
// Final: la tarjeta con tres estrellas y los símbolos que se vieron. Otorga `fortuna: true`.
//
// Configuración que le pasa el nivel:
//   { "precio": 5 }

import type { Minijuego } from '../motor.ts';
import { FORTUNAS } from './cartas/fortunas.ts';
import type { Fortuna } from './cartas/fortunas.ts';
import { cobrar } from './comun/cobro.ts';
import { abrirMarco } from './comun/marco.ts';
import type { Marco } from './comun/marco.ts';
import { animar, crear, crearBotonConDibujo, crearImagen, esperar, leerNumero, revolver } from './comun/piezas.ts';
import { armarPremio, mostrarResultado } from './comun/resultado.ts';

const PRECIO_POR_DEFECTO = 5;
const CARTAS_EN_LA_MESA = 3;
/** Lo que tarda Madame Lula en decir una fortuna; después habla Bobby. */
const PAUSA_PARA_LA_FORTUNA_EN_MILISEGUNDOS = 3000;
const DIBUJO_DEL_REVERSO = 'carta_reverso';

/** Lo que comparten las cartas de la mesa mientras se juega. */
interface Mesa {
  readonly marco: Marco;
  readonly lula: HTMLImageElement;
  readonly seguir: HTMLButtonElement;
  /** Los dibujos de los símbolos ya vistos, en el orden en que se voltearon. */
  readonly simbolosVistos: string[];
  /** Cuántas fortunas se han dicho. Sirve para que Bobby no hable si ya empezó otra fortuna. */
  fortunasDichas: number;
}

export const Cartas: Minijuego = (contexto) => {
  const { marco, resultado } = abrirMarco(contexto, 'morado');
  const precio = leerNumero(contexto.config, 'precio', PRECIO_POR_DEFECTO);

  void jugar();
  return resultado;

  async function jugar(): Promise<void> {
    const pago = await cobrar(marco, { precio, compra: DIBUJO_DEL_REVERSO });
    if (!pago) return;

    const simbolosVistos = await leerLasCartas(marco);
    if (simbolosVistos === null) return;

    await mostrarResultado(marco, { estrellas: 3, cosas: simbolosVistos, frase: '¡Qué futuro tan bonito te espera!' });
    marco.terminar({ exito: true, otorgar: armarPremio(marco, { loPropio: { fortuna: true }, precio, estrellas: 0 }) });
  }
};

/**
 * Pone la mesa y deja voltear cartas hasta que el jugador toca la palomita.
 * Devuelve los dibujos de los símbolos vistos, o `null` si el minijuego se cerró antes.
 */
function leerLasCartas(marco: Marco): Promise<string[] | null> {
  marco.area.replaceChildren();
  const escena = crear('div', 'cartas-escena', marco.area);
  const lula = crearImagen(marco.contexto, 'spr_lula', 'cartas-lula', escena);
  const mantel = crear('div', 'cartas-mantel', escena);
  const seguir = crearBotonConDibujo(marco.contexto, 'item_palomita', 'Seguir', escena);
  seguir.classList.add('mj-boton-grande', 'cartas-seguir');
  seguir.disabled = true; // aparece al voltear la primera carta

  const mesa: Mesa = { marco, lula, seguir, simbolosVistos: [], fortunasDichas: 0 };
  for (const fortuna of revolver(FORTUNAS).slice(0, CARTAS_EN_LA_MESA)) {
    ponerCarta(mesa, mantel, fortuna);
  }
  marco.indicar('Toca una carta y Madame Lula te dirá tu fortuna.', [DIBUJO_DEL_REVERSO]);

  return new Promise((terminar) => {
    seguir.addEventListener('click', () => terminar(mesa.simbolosVistos), { once: true, signal: marco.senal });
    marco.senal.addEventListener('abort', () => terminar(null), { once: true });
  });
}

/** Una carta boca abajo: un botón con dos caras (el reverso y el símbolo) que gira al tocarlo. */
function ponerCarta(mesa: Mesa, mantel: HTMLElement, fortuna: Fortuna): void {
  const { marco } = mesa;
  const carta = crear('button', 'cartas-carta', mantel);
  carta.type = 'button';
  carta.setAttribute('aria-label', 'Carta boca abajo');
  const giro = crear('div', 'cartas-giro', carta);
  crearImagen(marco.contexto, DIBUJO_DEL_REVERSO, 'cartas-cara cartas-reverso', giro);
  const frente = crear('div', 'cartas-cara cartas-frente', giro);
  crearImagen(marco.contexto, fortuna.dibujo, 'cartas-simbolo', frente);

  carta.addEventListener(
    'click',
    () => {
      const yaEstabaVolteada = carta.classList.contains('cartas-carta-volteada');
      if (yaEstabaVolteada) {
        // Tocar otra vez una carta volteada repite su fortuna: sirve para oírla de nuevo.
        animar(carta, 'mj-brinco');
      } else {
        carta.classList.add('cartas-carta-volteada');
        carta.setAttribute('aria-label', fortuna.enIngles);
        mesa.simbolosVistos.push(fortuna.dibujo);
        marco.sonar('sfx_carta');
        mesa.seguir.disabled = false;
      }
      void decirLaFortuna(mesa, fortuna);
    },
    { signal: marco.senal },
  );
}

/** Madame Lula cierra los ojos y dice la fortuna; luego Bobby dice el símbolo en inglés. */
async function decirLaFortuna(mesa: Mesa, fortuna: Fortuna): Promise<void> {
  const { marco, lula } = mesa;
  mesa.fortunasDichas += 1;
  const estaFortuna = mesa.fortunasDichas;

  lula.src = marco.contexto.assets.url('lula_ve');
  animar(lula, 'cartas-lula-adivina');
  marco.decir(fortuna.frase);
  await esperar(PAUSA_PARA_LA_FORTUNA_EN_MILISEGUNDOS, marco.senal);

  // Si mientras tanto se volteó otra carta, Madame Lula ya está con esa: aquí no se interrumpe nada.
  if (mesa.fortunasDichas !== estaFortuna || marco.senal.aborted) return;
  lula.src = marco.contexto.assets.url('spr_lula');
  marco.decir(fortuna.enIngles, 'en');
}
