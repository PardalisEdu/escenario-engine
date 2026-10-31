/**
 * Partida guardada (SaveBlob, §11). Es JSON plano y versionado.
 * El motor nunca escribe en localStorage: el host decide dónde guardarla.
 */
import type { Mira, Valor } from './esquema';

export interface SaveBlob {
  v: 2;
  /** id del nivel (meta.id del contenido). */
  nivel: string;
  estado: Record<string, Valor>;
  momento?: {
    jugador?: { x: number; y: number; mira: Mira };
    camara?: { x: number };
    /** Segundos jugados en este nivel. */
    tiempo?: number;
  };
}

/**
 * Lee una partida guardada como texto o como objeto.
 * - Una partida v1 se convierte a v2: se conserva el estado y el jugador aparece en el inicio del mapa.
 * - Si el JSON está corrupto o pertenece a otro nivel, se ignora con una advertencia.
 */
export function leerPartida(guardada: string | object | null | undefined, nivel: string): SaveBlob | undefined {
  if (!guardada) return undefined;

  let crudo: unknown = guardada;
  if (typeof crudo === 'string') {
    try {
      crudo = JSON.parse(crudo);
    } catch {
      console.warn('[escenario-engine] partida guardada inválida (JSON corrupto); se ignora');
      return undefined;
    }
  }
  if (typeof crudo !== 'object' || crudo === null || Array.isArray(crudo)) {
    console.warn('[escenario-engine] partida guardada inválida; se ignora');
    return undefined;
  }

  const datos = crudo as { v?: unknown; nivel?: unknown; estado?: unknown; momento?: unknown };
  if (datos.v === 2 && typeof datos.nivel === 'string' && datos.nivel !== nivel) {
    console.warn(`[escenario-engine] la partida guardada es del nivel "${datos.nivel}", no de "${nivel}"; se ignora`);
    return undefined;
  }

  const estadoLimpio = limpiarEstado(datos.estado);
  if (datos.v === 2) {
    return {
      v: 2,
      nivel,
      estado: estadoLimpio,
      momento: limpiarMomento(datos.momento),
    };
  }

  // Aquí irían migraciones por versión del contenido cuando existan.
  return { v: 2, nivel, estado: estadoLimpio };
}

function limpiarEstado(estado: unknown): Record<string, Valor> {
  const resultado: Record<string, Valor> = {};
  if (typeof estado !== 'object' || estado === null || Array.isArray(estado)) return resultado;
  for (const [clave, valor] of Object.entries(estado)) {
    if (clave === '__proto__') continue;
    if (typeof valor === 'string' || typeof valor === 'number' || typeof valor === 'boolean') {
      resultado[clave] = valor;
    }
  }
  return resultado;
}

function limpiarMomento(momento: unknown): SaveBlob['momento'] {
  if (typeof momento !== 'object' || momento === null || Array.isArray(momento)) return undefined;
  const m = momento as Record<string, unknown>;
  const limpio: NonNullable<SaveBlob['momento']> = {};

  if (typeof m.jugador === 'object' && m.jugador !== null) {
    const j = m.jugador as Record<string, unknown>;
    if (Number.isFinite(j.x) && Number.isFinite(j.y) && (j.mira === 'izquierda' || j.mira === 'derecha')) {
      limpio.jugador = { x: j.x as number, y: j.y as number, mira: j.mira };
    }
  }
  if (typeof m.camara === 'object' && m.camara !== null) {
    const c = m.camara as Record<string, unknown>;
    if (Number.isFinite(c.x)) limpio.camara = { x: c.x as number };
  }
  if (Number.isFinite(m.tiempo) && (m.tiempo as number) >= 0) {
    limpio.tiempo = m.tiempo as number;
  }
  return Object.keys(limpio).length > 0 ? limpio : undefined;
}
