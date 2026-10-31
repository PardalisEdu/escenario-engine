/**
 * Fase 3 de la validación (§12): enlaces dentro del contenido.
 *
 * Revisa que todo lo que se nombra exista: secuencias, hablantes, efectos, minijuegos,
 * y que toda condición o "pon" use objetivos o variables declarados en "estado".
 */
import { estaDeclarado, nombresUsados } from './condiciones';
import type { Diagnostico } from './diagnostico';
import type { Condicion, Contenido, Paso, PasosOSecuencia } from './esquema';
import { recorrerPasos } from './recorrer-pasos';

/** Tabla global de efectos. El adaptador de Phaser implementa cada uno (efectos.ts). */
export const EFECTOS = ['magia', 'confeti'] as const;
export type NombreDeEfecto = (typeof EFECTOS)[number];

/**
 * Gestos que todo personaje sabe hacer sin atlas: el adaptador de Phaser los anima moviendo el sprite (actor.ts).
 * Un personaje también puede tener gestos propios: cualquier animación extra en sus "animaciones".
 */
export const GESTOS = ['saltar', 'saludar', 'asentir', 'sorpresa'] as const;
export type NombreDeGesto = (typeof GESTOS)[number];

/** Pasos que no caben en la intro: quien la salta no debe perderse estado ni quedarse a medio minijuego. */
const PASOS_PROHIBIDOS_EN_LA_INTRO: Record<string, string> = {
  pon: '"pon"',
  juego: '"juego"',
  elige: '"elige"',
};

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
  if (jugador && !Object.hasOwn(contenido.meta.personajes, jugador.personaje)) {
    diagnostico.error(`jugador.personaje "${jugador.personaje}" no existe en meta.personajes`);
  }

  revisarAcompanante(contenido, diagnostico);
  revisarRamas(contenido, revisarCondicion, diagnostico);
  if (contenido.intro) revisarIntro(contenido, contenido.intro, diagnostico);

  if (contenido.salida) {
    revisarCondicion(contenido.salida.requiere, 'salida.requiere');
    revisarCondicion(contenido.salida.flecha?.visibleCuando, 'salida.flecha.visibleCuando');
  }

  recorrerPasos(contenido, {
    referenciaASecuencia(nombre, ruta) {
      if (!Object.hasOwn(contenido.secuencias, nombre)) {
        diagnostico.error(`secuencia "${nombre}" usada en ${ruta} pero no existe en "secuencias"`);
      }
    },
    paso(paso, ruta) {
      revisarPaso(paso, ruta, contenido, minijuegos, revisarCondicion, diagnostico);
    },
  });

  revisarCiclosDeSecuencias(contenido.secuencias, diagnostico);
}

function revisarAcompanante(contenido: Contenido, diagnostico: Diagnostico): void {
  const acompanante = contenido.acompanante;
  if (!acompanante) return;
  if (!contenido.jugador) {
    diagnostico.error('acompanante: necesita un "jugador" a quien seguir');
  }
  if (!Object.hasOwn(contenido.meta.personajes, acompanante.personaje)) {
    diagnostico.error(`acompanante.personaje "${acompanante.personaje}" no existe en meta.personajes`);
  }
  if (acompanante.personaje === contenido.jugador?.personaje) {
    diagnostico.error('acompanante.personaje no puede ser el mismo personaje que jugador.personaje');
  }
}

/**
 * La intro solo se mira y se puede saltar en cualquier momento, así que no puede cambiar el estado
 * ni pedir decisiones. Se revisan también las secuencias que usa.
 */
function revisarIntro(contenido: Contenido, intro: PasosOSecuencia, diagnostico: Diagnostico): void {
  const secuenciasVistas = new Set<string>();

  const revisarLista = (pasos: Paso[], ruta: string) => {
    pasos.forEach((paso, i) => revisarPasoDeLaIntro(paso, `${ruta}[${i}]`));
  };
  const revisarSecuencia = (nombre: string) => {
    if (secuenciasVistas.has(nombre) || !Object.hasOwn(contenido.secuencias, nombre)) return;
    secuenciasVistas.add(nombre);
    revisarLista(contenido.secuencias[nombre]!, `secuencias.${nombre}`);
  };
  const revisarPasoDeLaIntro = (paso: Paso, ruta: string) => {
    if (Object.hasOwn(PASOS_PROHIBIDOS_EN_LA_INTRO, paso.tipo)) {
      const nombre = PASOS_PROHIBIDOS_EN_LA_INTRO[paso.tipo];
      diagnostico.error(`${ruta}: ${nombre} no se permite en la intro (se puede saltar); muévelo al primer diálogo`);
    }
    if (paso.tipo === 'condicional') revisarLista(paso.pasos, `${ruta}.dice`);
    if (paso.tipo === 'secuencia') revisarSecuencia(paso.nombre);
  };

  if (typeof intro === 'string') revisarSecuencia(intro);
  else revisarLista(intro, 'intro');
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
      if (!Object.hasOwn(contenido.meta.personajes, paso.hablante)) {
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

    case 'gesto':
      if (!sabeHacerElGesto(contenido, paso.quien, paso.nombre)) {
        diagnostico.error(
          `gesto "${paso.nombre}" en ${ruta}: no es un gesto del motor (${GESTOS.join(', ')}) ` +
            `ni una animación de ${paso.quien ?? 'el jugador'}`,
        );
      }
      break; // "quien" se revisa contra el mapa en la fase 4

    case 'enfoca':
    case 'espera':
    case 'titulo':
      break; // el objetivo de "enfoca" se revisa contra el mapa en la fase 4
  }
}

/** Un gesto del motor, o una animación propia del personaje (o del jugador). */
function sabeHacerElGesto(contenido: Contenido, quien: string | undefined, gesto: string): boolean {
  if ((GESTOS as readonly string[]).includes(gesto)) return true;

  const idDelPersonaje = quien ?? contenido.jugador?.personaje;
  const esElJugador = idDelPersonaje === contenido.jugador?.personaje;
  if (esElJugador && Object.hasOwn(contenido.jugador?.animaciones ?? {}, gesto)) return true;

  if (idDelPersonaje === undefined || !Object.hasOwn(contenido.meta.personajes, idDelPersonaje)) return false;
  return Object.hasOwn(contenido.meta.personajes[idDelPersonaje]!.animaciones ?? {}, gesto);
}

/** Detecta llamadas circulares entre secuencias antes de jugar (evita esperar al límite de profundidad en runtime). */
function revisarCiclosDeSecuencias(secuencias: Record<string, Paso[]>, diagnostico: Diagnostico): void {
  const visitadas = new Set<string>();
  const enPila = new Set<string>();

  const referenciasDePasos = (pasos: Paso[]): string[] => {
    const nombres: string[] = [];
    for (const paso of pasos) {
      if (paso.tipo === 'secuencia') nombres.push(paso.nombre);
      else if (paso.tipo === 'condicional') nombres.push(...referenciasDePasos(paso.pasos));
      else if (paso.tipo === 'elige') {
        for (const opcion of paso.opciones) {
          if (typeof opcion.pasos === 'string') nombres.push(opcion.pasos);
          else nombres.push(...referenciasDePasos(opcion.pasos));
        }
      }
    }
    return nombres;
  };

  const recorrer = (nombre: string, cadena: string[]) => {
    if (enPila.has(nombre)) {
      diagnostico.error(`ciclo entre secuencias: ${[...cadena, nombre].join(' → ')}`);
      return;
    }
    if (visitadas.has(nombre) || !Object.hasOwn(secuencias, nombre)) return;

    visitadas.add(nombre);
    enPila.add(nombre);
    for (const destino of referenciasDePasos(secuencias[nombre]!)) {
      recorrer(destino, [...cadena, nombre]);
    }
    enPila.delete(nombre);
  };

  for (const nombre of Object.keys(secuencias)) recorrer(nombre, []);
}
