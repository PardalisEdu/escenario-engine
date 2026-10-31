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
 * Una partida v1 se convierte a v2: se conserva el estado y el jugador
 * aparece en el punto de inicio del mapa.
 */
export function leerPartida(guardada: string | object | null | undefined, nivel: string): SaveBlob | undefined {
  if (!guardada) return undefined;

  const datos: { v?: number; estado?: Record<string, Valor> } =
    typeof guardada === 'string' ? JSON.parse(guardada) : guardada;
  if (datos.v === 2) return datos as SaveBlob;

  // Aquí irían migraciones por versión del contenido cuando existan.
  return { v: 2, nivel, estado: datos.estado ?? {} };
}
