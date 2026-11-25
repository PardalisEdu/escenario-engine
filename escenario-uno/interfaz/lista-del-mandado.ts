// La lista del mandado: una hojita en la esquina con el dibujo de cada cosa que pidió mamá.
// Cuando se consigue algo, su dibujo se marca con una palomita. No lleva texto: nada requiere leer.

import { crear, crearDibujoDeCosa } from './elementos.ts';

/** Cada cosa de la lista y el objetivo del nivel que la consigue (la verdulería da cinco de una vez). */
const COSAS_DE_LA_LISTA = [
  { dibujo: 'item_maiz', objetivo: 'maiz' },
  { dibujo: 'item_cebolla', objetivo: 'verduras' },
  { dibujo: 'item_chiles', objetivo: 'chiles' },
  { dibujo: 'item_lechuga', objetivo: 'verduras' },
  { dibujo: 'item_rabanos', objetivo: 'verduras' },
  { dibujo: 'item_oregano', objetivo: 'verduras' },
  { dibujo: 'item_limon', objetivo: 'verduras' },
  { dibujo: 'item_tostadas', objetivo: 'tostadas' },
];

export interface ListaDelMandado {
  /** Marca con palomita lo que ya se consiguió. Lo recién conseguido da un brinquito. */
  actualizar(conseguido: ReadonlySet<string>): void;
}

export function crearListaDelMandado(padre: HTMLElement): ListaDelMandado {
  const hoja = crear('div', 'hud-lista', padre);
  hoja.setAttribute('role', 'img');
  hoja.setAttribute('aria-label', 'La lista del mandado');

  const renglones: { elemento: HTMLElement; objetivo: string }[] = [];
  for (const cosa of COSAS_DE_LA_LISTA) {
    const renglon = crear('div', 'hud-lista-cosa', hoja);
    crearDibujoDeCosa(cosa.dibujo, 'hud-lista-dibujo', renglon);
    crearDibujoDeCosa('item_palomita', 'hud-lista-palomita', renglon);
    renglones.push({ elemento: renglon, objetivo: cosa.objetivo });
  }

  return {
    actualizar(conseguido) {
      for (const renglon of renglones) {
        renglon.elemento.classList.toggle('hud-lista-conseguida', conseguido.has(renglon.objetivo));
      }
    },
  };
}
