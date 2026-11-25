// El puesto de Doña Tepo: el decorado que comparten las tres fases (el toldo, los huacales, la vendedora
// asomándose y la mesa con su mantel) y el cambio suave de lo que hay sobre la mesa entre una fase y otra.
//
// Doña Tepo también es un botón: al tocarla repite la última indicación, porque quien juega todavía no lee.

import type { Marco } from '../comun/marco.ts';
import { animar, crear, crearImagen, esperar } from '../comun/piezas.ts';

/** Lo que tarda en irse lo que había en la mesa. Debe coincidir con `verduleria-se-va` en el CSS. */
const DURACION_DE_LA_SALIDA_EN_MILISEGUNDOS = 320;
/** Lo que se asoma de cada huacal del fondo. */
const DIBUJOS_DE_LOS_HUACALES = ['item_maiz', 'item_fruta'];

export interface Puesto {
  /** Todo el puesto. Sirve de escena para lo que vuela de un lado a otro. */
  readonly escena: HTMLElement;
  /** Doña Tepo, para que las cosas puedan volar hacia ella. */
  readonly tepo: HTMLElement;
  /** Dice qué hay que hacer (con dibujos en la franja) y lo recuerda para repetirlo al tocar a Doña Tepo. */
  indicar(frase: string, dibujos: readonly string[]): void;
  /** Doña Tepo da un brinquito (cuando habla o se alegra). */
  brincarConTepo(): void;
  /**
   * Quita con suavidad lo que había sobre la mesa y entrega un espacio nuevo, vacío, para la fase siguiente.
   * `claseDeLaFase` es la clase de CSS que acomoda las cosas de esa fase.
   */
  cambiarLoDeLaMesa(claseDeLaFase: string): Promise<HTMLElement>;
}

export function armarPuesto(marco: Marco): Puesto {
  marco.area.replaceChildren();
  const escena = crear('div', 'verduleria-puesto', marco.area);
  crear('div', 'verduleria-toldo', escena);
  for (const dibujo of DIBUJOS_DE_LOS_HUACALES) {
    const huacal = crear('div', 'verduleria-huacal', escena);
    crearImagen(marco.contexto, dibujo, 'verduleria-huacal-dibujo', huacal);
  }

  const tepo = crear('button', 'verduleria-tepo', escena);
  tepo.type = 'button';
  tepo.setAttribute('aria-label', 'Doña Tepo: repetir la indicación');
  const dibujoDeTepo = crearImagen(marco.contexto, 'spr_tepo', 'verduleria-tepo-dibujo', tepo);
  const mesa = crear('div', 'verduleria-mesa', escena);

  let ultimaIndicacion = '';
  let sobreLaMesa: HTMLElement | undefined;

  function brincarConTepo(): void {
    animar(dibujoDeTepo, 'mj-brinco');
  }

  tepo.addEventListener(
    'click',
    () => {
      if (ultimaIndicacion === '') return;
      brincarConTepo();
      marco.decir(ultimaIndicacion);
    },
    { signal: marco.senal },
  );

  return {
    escena,
    tepo,
    brincarConTepo,
    indicar(frase, dibujos) {
      if (marco.senal.aborted) return;
      ultimaIndicacion = frase;
      marco.indicar(frase, dibujos);
    },
    async cambiarLoDeLaMesa(claseDeLaFase) {
      if (sobreLaMesa !== undefined) {
        sobreLaMesa.classList.add('verduleria-se-va');
        await esperar(DURACION_DE_LA_SALIDA_EN_MILISEGUNDOS, marco.senal);
        sobreLaMesa.remove();
      }
      sobreLaMesa = crear('div', `verduleria-sobre-la-mesa verduleria-llega ${claseDeLaFase}`, mesa);
      brincarConTepo();
      return sobreLaMesa;
    },
  };
}
