// Fase 2 de la verdulería: escoger una lechuga de buen tamaño.
// Hay tres lechugas en fila y en desorden: una muy chiquita, una marchita y una grande y fresca (la buena).
// Las que no convienen responden amable y se puede volver a elegir cuantas veces haga falta.

import type { Marco } from '../comun/marco.ts';
import { animar, crear, crearImagen, esperar, revolver } from '../comun/piezas.ts';
import { crearAviso } from './aviso.ts';
import type { Puesto } from './puesto.ts';
import type { VozEnDosIdiomas } from './voz-en-dos-idiomas.ts';

interface Lechuga {
  readonly clave: string;
  /** Lo que lee un lector de pantalla. */
  readonly nombre: string;
  /** Por qué no conviene. La lechuga buena no lleva explicación. */
  readonly porQueNo?: string;
}

const LECHUGAS: readonly Lechuga[] = [
  { clave: 'item_lechuga_chica', nombre: 'Lechuga chiquita', porQueNo: 'Esa está muy chiquita.' },
  { clave: 'item_lechuga', nombre: 'Lechuga grande' },
  { clave: 'item_lechuga_marchita', nombre: 'Lechuga marchita', porQueNo: 'Esa ya está marchita.' },
];

/** Tiempo para oír la felicitación y el inglés del primo antes de pasar a pagar. */
const PAUSA_AL_ELEGIR_BIEN_EN_MILISEGUNDOS = 3200;

/** Juega la fase completa. Devuelve cuántas veces se tocó una lechuga que no convenía. */
export async function jugarFaseDeLaLechuga(marco: Marco, puesto: Puesto, voz: VozEnDosIdiomas): Promise<number> {
  const sobreLaMesa = await puesto.cambiarLoDeLaMesa('verduleria-fase-lechuga');
  puesto.indicar('Ahora escoge una lechuga grande y fresca.', ['item_lechuga']);

  let toquesEquivocados = 0;
  const lechugaElegida = crearAviso<HTMLElement | undefined>(marco.senal, undefined);

  for (const lechuga of revolver(LECHUGAS)) {
    const boton = crear('button', 'verduleria-lechuga', sobreLaMesa);
    boton.type = 'button';
    boton.setAttribute('aria-label', lechuga.nombre);
    crearImagen(marco.contexto, lechuga.clave, 'verduleria-lechuga-dibujo', boton);
    boton.addEventListener('click', () => alTocar(lechuga, boton), { signal: marco.senal });
  }

  function alTocar(lechuga: Lechuga, boton: HTMLButtonElement): void {
    if (lechuga.porQueNo === undefined) {
      lechugaElegida.avisar(boton);
      return;
    }
    toquesEquivocados += 1;
    animar(boton, 'mj-temblor');
    marco.sonar('sfx_no');
    voz.decir(lechuga.porQueNo);
  }

  const botonDeLaBuena = await lechugaElegida.promesa;
  if (botonDeLaBuena === undefined || marco.senal.aborted) return toquesEquivocados;

  // Celebración corta: la lechuga buena brinca y brilla; las otras se apagan.
  sobreLaMesa.classList.add('verduleria-lechuga-ya-elegida');
  botonDeLaBuena.classList.add('verduleria-lechuga-buena');
  animar(botonDeLaBuena, 'mj-brinco');
  puesto.brincarConTepo();
  marco.sonar('sfx_bien');
  void voz.decirEnDosIdiomas('¡Esa sí! Grande y fresquecita.', 'fresh lettuce!');
  await esperar(PAUSA_AL_ELEGIR_BIEN_EN_MILISEGUNDOS, marco.senal);
  return toquesEquivocados;
}
