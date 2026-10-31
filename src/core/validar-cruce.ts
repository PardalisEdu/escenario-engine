/**
 * Fase 4 de la validación (§12): cruce entre el mapa (el DÓNDE) y el contenido (el QUÉ PASA).
 *
 * La unión debe ser completa en los dos sentidos: cada NPC del mapa tiene su diálogo
 * en el contenido, y cada NPC del contenido tiene su objeto en el mapa. Lo mismo para
 * los props interactivos, la salida, las zonas de comentario y los destinos de "camina".
 */
import type { Diagnostico } from './diagnostico';
import type { Contenido } from './esquema';
import { puntoDentroDePoligono } from './geometria';
import type { Mundo } from './mundo';
import { recorrerPasos } from './recorrer-pasos';

export function revisarCruce(contenido: Contenido, mundo: Mundo, hayMapa: boolean, diagnostico: Diagnostico): void {
  revisarNpcs(contenido, mundo, hayMapa, diagnostico);
  revisarInteractivos(contenido, mundo, hayMapa, diagnostico);
  revisarPisoEInicio(mundo, diagnostico);
  revisarZonasDeComentario(contenido, mundo, diagnostico);
  revisarSalida(contenido, mundo, hayMapa, diagnostico);
  revisarCaminatas(contenido, mundo, diagnostico);
  if (hayMapa) advertirDatosDuplicados(contenido, diagnostico);
  else if (contenido.mundo.camara.enfoques) {
    diagnostico.advertencia('mundo.camara.enfoques está deprecado; usa puntos enfoqueCamara en Tiled');
  }
}

function revisarNpcs(contenido: Contenido, mundo: Mundo, hayMapa: boolean, diagnostico: Diagnostico): void {
  for (const [id, npc] of Object.entries(mundo.npcs)) {
    if (!Object.hasOwn(contenido.npcs, id)) {
      diagnostico.error(`mapa: ${npc.descripcion} (npc) tiene id "${id}", que no existe en npcs`);
    }
  }
  for (const id of Object.keys(contenido.npcs)) {
    if (Object.hasOwn(mundo.npcs, id)) continue;
    if (hayMapa) diagnostico.error(`npcs.${id} no tiene objeto de clase npc en la capa "npcs"`);
    else diagnostico.error(`npcs.${id} no tiene coordenadas x, y`);
  }
}

function revisarInteractivos(contenido: Contenido, mundo: Mundo, hayMapa: boolean, diagnostico: Diagnostico): void {
  const idsDePropsInteractivos = new Set<string>();
  for (const prop of mundo.props) {
    if (prop.id === undefined) continue;
    idsDePropsInteractivos.add(prop.id);
    if (!Object.hasOwn(contenido.interactivos, prop.id)) {
      diagnostico.error(`mapa: ${prop.descripcion} (${prop.clase}) tiene id "${prop.id}", que no existe en interactivos`);
    }
  }
  const dondeBuscar = hayMapa ? 'mapa' : 'contenido (modo sin mapa)';
  for (const id of Object.keys(contenido.interactivos)) {
    if (!idsDePropsInteractivos.has(id)) {
      diagnostico.error(`interactivos.${id} no tiene un objeto de decorado con ese id en el ${dondeBuscar}`);
    }
  }
}

function revisarPisoEInicio(mundo: Mundo, diagnostico: Diagnostico): void {
  if (mundo.pisos.length === 0) {
    diagnostico.error('mapa: la capa "piso" necesita al menos un polígono de clase piso');
  }
  const inicio = mundo.iniciosDelJugador[0];
  const hayUnoSolo = mundo.iniciosDelJugador.length === 1;
  const estaSobreElPiso = inicio !== undefined && mundo.pisos.some((poligono) => puntoDentroDePoligono(inicio, poligono));
  if (!hayUnoSolo || !estaSobreElPiso) {
    diagnostico.error('mapa: inicioJugador debe existir una sola vez y estar dentro de un polígono "piso"');
  }
}

function revisarZonasDeComentario(contenido: Contenido, mundo: Mundo, diagnostico: Diagnostico): void {
  for (const zona of mundo.zonasDeComentario) {
    if (!Object.hasOwn(contenido.comentarios, zona.grupo)) {
      diagnostico.error(`${zona.descripcion}: grupo "${zona.grupo}" no existe en comentarios`);
    }
  }
}

function revisarSalida(contenido: Contenido, mundo: Mundo, hayMapa: boolean, diagnostico: Diagnostico): void {
  if (contenido.salida && !mundo.salida) {
    if (hayMapa) diagnostico.error('salida: falta el objeto de clase salida en la capa "interaccion"');
    else diagnostico.error('salida: falta salida.x');
  }
  if (!contenido.salida && mundo.salida) {
    diagnostico.advertencia(`${mundo.salida.descripcion}: hay salida en el mapa pero no "salida" en el contenido`);
  }
}

/** Cada "camina" debe tener quién camine y, si va a un punto con nombre, que ese punto exista. */
function revisarCaminatas(contenido: Contenido, mundo: Mundo, diagnostico: Diagnostico): void {
  const quienesPuedenCaminar = new Set(Object.keys(mundo.npcs));
  if (contenido.jugador) quienesPuedenCaminar.add(contenido.jugador.personaje);

  recorrerPasos(contenido, {
    paso(paso, ruta) {
      if (paso.tipo !== 'camina') return;

      if (paso.quien === undefined && !contenido.jugador) {
        diagnostico.error(`camina en ${ruta}: no hay jugador; indica "quien"`);
      }
      if (paso.quien !== undefined && !quienesPuedenCaminar.has(paso.quien)) {
        diagnostico.error(`camina en ${ruta}: "quien": "${paso.quien}" no es el jugador ni un NPC del mapa`);
      }
      if (typeof paso.destino === 'string' && !Object.hasOwn(mundo.puntos, paso.destino)) {
        diagnostico.error(`camina "${paso.destino}" en ${ruta}: no hay punto con ese nombre`);
      }
    },
  });
}

/** Con mapa, manda el mapa: las coordenadas del JSON v1 se ignoran (§5.4). */
function advertirDatosDuplicados(contenido: Contenido, diagnostico: Diagnostico): void {
  const ignorado = (que: string) => diagnostico.advertencia(`dato duplicado: ${que} se ignora porque manda el mapa`);

  if (contenido.layout) ignorado('layout');
  if (contenido.mundo.capas) ignorado('mundo.capas');
  if (contenido.mundo.piso) ignorado('mundo.piso');
  if (contenido.mundo.inicio !== undefined) ignorado('mundo.inicio');
  if (contenido.mundo.camara.enfoques) ignorado('mundo.camara.enfoques');
  if (contenido.salida?.x !== undefined) ignorado('salida.x');
  for (const [id, npc] of Object.entries(contenido.npcs)) {
    if (npc.x !== undefined || npc.radio !== undefined) ignorado(`las coordenadas de npcs.${id}`);
  }
}
