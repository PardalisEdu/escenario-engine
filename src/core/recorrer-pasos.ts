/**
 * Recorre todos los pasos de un contenido, incluidos los anidados, en un solo lugar.
 * Así cada fase de validación solo dice qué revisar en cada paso, no cómo encontrarlos.
 *
 * Las rutas usan los nombres del JSON (p. ej. "npcs.tortu.dialogo[1].dice[2]")
 * para que los mensajes de error apunten a lo que escribió la autora.
 */
import type { Contenido, Paso, PasosOSecuencia } from './esquema';

export interface Visitante {
  /** Se llama una vez por cada paso. */
  paso?(paso: Paso, ruta: string): void;
  /** Se llama cuando un lugar usa una secuencia por nombre en vez de pasos escritos. */
  referenciaASecuencia?(nombre: string, ruta: string): void;
}

export function recorrerPasos(contenido: Contenido, visitante: Visitante): void {
  for (const [nombre, pasos] of Object.entries(contenido.secuencias)) {
    recorrerLista(pasos, `secuencias.${nombre}`, visitante);
  }

  for (const tipo of ['npcs', 'interactivos'] as const) {
    for (const [id, interlocutor] of Object.entries(contenido[tipo])) {
      interlocutor.dialogo.forEach((rama, i) => {
        recorrerLista(rama.pasos, `${tipo}.${id}.dialogo[${i}].dice`, visitante);
      });
      if (interlocutor.alVolver) {
        recorrerPasosOSecuencia(interlocutor.alVolver.siLogrado, `${tipo}.${id}.alVolver.siLogrado`, visitante);
        recorrerPasosOSecuencia(interlocutor.alVolver.siNo, `${tipo}.${id}.alVolver.siNo`, visitante);
      }
    }
  }

  for (const [grupo, lineas] of Object.entries(contenido.comentarios)) {
    recorrerLista(lineas, `comentarios.${grupo}`, visitante);
  }

  if (contenido.salida?.siBloqueada) {
    recorrerPasosOSecuencia(contenido.salida.siBloqueada, 'salida.siBloqueada', visitante);
  }
}

function recorrerLista(pasos: Paso[], ruta: string, visitante: Visitante): void {
  pasos.forEach((paso, i) => recorrerPaso(paso, `${ruta}[${i}]`, visitante));
}

function recorrerPasosOSecuencia(valor: PasosOSecuencia, ruta: string, visitante: Visitante): void {
  if (typeof valor === 'string') visitante.referenciaASecuencia?.(valor, ruta);
  else recorrerLista(valor, ruta, visitante);
}

function recorrerPaso(paso: Paso, ruta: string, visitante: Visitante): void {
  visitante.paso?.(paso, ruta);

  switch (paso.tipo) {
    case 'condicional':
      recorrerLista(paso.pasos, `${ruta}.dice`, visitante);
      break;
    case 'elige':
      paso.opciones.forEach((opcion, i) => {
        recorrerPasosOSecuencia(opcion.pasos, `${ruta}.opciones[${i}].secuencia`, visitante);
      });
      break;
    case 'secuencia':
      visitante.referenciaASecuencia?.(paso.nombre, ruta);
      break;
  }
}
