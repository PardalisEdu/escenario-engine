/**
 * Fase 3 de la validación (§12): enlaces dentro del contenido.
 *
 * Revisa que todo lo que se nombra exista: secuencias, hablantes, efectos, minijuegos,
 * y que toda condición o "pon" use objetivos o variables declarados en "estado".
 */
import { estaDeclarado, nombresUsados } from './condiciones';
import type { Diagnostico } from './diagnostico';
import type { Condicion, Contenido, Paso } from './esquema';
import { recorrerPasos } from './recorrer-pasos';

/** Tabla global de efectos. El adaptador de Phaser implementa cada uno (efectos.ts). */
export const EFECTOS = ['magia', 'confeti'] as const;
export type NombreDeEfecto = (typeof EFECTOS)[number];

/**
 * @param minijuegos claves de las fábricas registradas por el host; si se omite
 *                   (por ejemplo, desde la línea de comandos) no se revisan.
 */
export function revisarEnlaces(contenido: Contenido, minijuegos: string[] | undefined, diagnostico: Diagnostico): void {
  const revisarCondicion = (condicion: Condicion | undefined, ruta: string) => {
    if (condicion === undefined) return;
    for (const nombre of nombresUsados(condicion)) {
      if (!estaDeclarado(nombre, contenido.estado)) {
        diagnostico.error(`condición "${nombre}" usada en ${ruta} pero no está en estado.objetivos ni estado.variables`);
      }
    }
  };

  const jugador = contenido.jugador;
  if (jugador && !contenido.meta.personajes[jugador.personaje]) {
    diagnostico.error(`jugador.personaje "${jugador.personaje}" no existe en meta.personajes`);
  }

  revisarRamas(contenido, revisarCondicion, diagnostico);

  if (contenido.salida) {
    revisarCondicion(contenido.salida.requiere, 'salida.requiere');
    revisarCondicion(contenido.salida.flecha?.visibleCuando, 'salida.flecha.visibleCuando');
  }

  recorrerPasos(contenido, {
    referenciaASecuencia(nombre, ruta) {
      if (!contenido.secuencias[nombre]) {
        diagnostico.error(`secuencia "${nombre}" usada en ${ruta} pero no existe en "secuencias"`);
      }
    },
    paso(paso, ruta) {
      revisarPaso(paso, ruta, contenido, minijuegos, revisarCondicion, diagnostico);
    },
  });
}

/** Condiciones de las ramas, ramas inalcanzables y "conItem" de alVolver. */
function revisarRamas(
  contenido: Contenido,
  revisarCondicion: (condicion: Condicion | undefined, ruta: string) => void,
  diagnostico: Diagnostico,
): void {
  for (const tipo of ['npcs', 'interactivos'] as const) {
    for (const [id, interlocutor] of Object.entries(contenido[tipo])) {
      let yaHuboUnaRamaSinCondicion = false;

      interlocutor.dialogo.forEach((rama, i) => {
        const ruta = `${tipo}.${id}.dialogo[${i}]`;
        // Una rama sin condición siempre se cumple: las que vienen después nunca se ejecutan.
        if (yaHuboUnaRamaSinCondicion) {
          diagnostico.advertencia(`${ruta}: rama inalcanzable, hay una rama sin condición antes`);
        }
        if (rama.condicion === undefined) yaHuboUnaRamaSinCondicion = true;
        revisarCondicion(rama.condicion, ruta);
      });

      if (interlocutor.alVolver) {
        revisarCondicion(interlocutor.alVolver.conItem, `${tipo}.${id}.alVolver.conItem`);
      }
    }
  }
}

function revisarPaso(
  paso: Paso,
  ruta: string,
  contenido: Contenido,
  minijuegos: string[] | undefined,
  revisarCondicion: (condicion: Condicion | undefined, ruta: string) => void,
  diagnostico: Diagnostico,
): void {
  switch (paso.tipo) {
    case 'linea':
      if (!contenido.meta.personajes[paso.hablante]) {
        diagnostico.error(`${ruta}: el hablante "${paso.hablante}" no existe en meta.personajes`);
      }
      break;

    case 'condicional':
      revisarCondicion(paso.condicion, ruta);
      break;

    case 'elige': {
      paso.opciones.forEach((opcion, i) => revisarCondicion(opcion.condicion, `${ruta}.opciones[${i}]`));
      const todasTienenCondicion = paso.opciones.every((opcion) => opcion.condicion !== undefined);
      if (todasTienenCondicion) {
        diagnostico.advertencia(`${ruta}: todas las opciones de elige tienen condición; si ninguna se cumple, el paso se salta`);
      }
      break;
    }

    case 'juego':
      if (minijuegos && !minijuegos.includes(paso.clave)) {
        diagnostico.error(`"juego": "${paso.clave}" usado en ${ruta} pero no registrado en el host`);
      }
      break;

    case 'efecto':
      if (!(EFECTOS as readonly string[]).includes(paso.nombre)) {
        diagnostico.error(`efecto "${paso.nombre}" en ${ruta} no está en la tabla global de efectos (${EFECTOS.join(', ')})`);
      }
      break;

    case 'pon':
      for (const nombre of Object.keys(paso.valores)) {
        if (!estaDeclarado(nombre, contenido.estado)) {
          diagnostico.error(`"pon" de "${nombre}" en ${ruta} pero no está en estado.objetivos ni estado.variables`);
        }
      }
      break;

    case 'camina':
      if (typeof paso.destino === 'number') {
        diagnostico.advertencia(`${ruta}: camina numérico está deprecado; usa { x, y } o un punto con nombre`);
      }
      break; // el destino y "quien" se revisan contra el mapa en la fase 4

    case 'secuencia':
      break; // la referencia se revisa en referenciaASecuencia
  }
}
