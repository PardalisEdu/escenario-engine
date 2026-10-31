/**
 * Validación de un nivel (§12). Pipeline de fases; la primera que falla detiene el arranque:
 *
 *   1. parse      el contenido es JSON válido
 *   2. schema     tipos, campos obligatorios y enums (contenido y mapa)
 *   3. enlaces    lo que se nombra existe (validar-enlaces.ts)
 *   4. cruce      mapa ↔ contenido coinciden (validar-cruce.ts)
 *   5. build      los assets existen (ocurre al cargar el nivel en el navegador)
 *
 * No depende de Phaser: corre igual en el navegador y en CI (ver src/cli.ts).
 */
import { Diagnostico } from './diagnostico';
import { esquemaContenido, rutaLegible, type Contenido } from './esquema';
import { construirMundoSinMapa, normalizarFormatoViejo } from './legacy';
import { leerMapaTiled, type TiledMap } from './mapa-tiled';
import type { Mundo } from './mundo';
import { revisarCruce } from './validar-cruce';
import { revisarEnlaces } from './validar-enlaces';

/** Un nivel listo para jugarse: el contenido validado y su mundo. */
export interface Nivel {
  contenido: Contenido;
  mundo: Mundo;
}

export interface ResultadoDeValidacion {
  errores: string[];
  advertencias: string[];
  /** Solo existe si no hubo errores. */
  nivel?: Nivel;
}

export interface EntradaDeValidacion {
  /** El JSON de contenido, como objeto o como texto. */
  config: unknown;
  /** El mapa de Tiled ya cargado (con tilesets externos resueltos). Sin mapa: formato v1. */
  mapa?: TiledMap;
  /** Claves de minijuegos registrados por el host. Si se omite, no se revisan. */
  minijuegos?: string[];
}

/** El error que se emite cuando un nivel no pasa la validación. */
export class EscenarioError extends Error {
  constructor(
    readonly errores: string[],
    readonly advertencias: string[] = [],
  ) {
    super(`escenario-engine: ${errores.length} error(es) de validación\n  - ${errores.join('\n  - ')}`);
  }
}

export function validar(entrada: EntradaDeValidacion): ResultadoDeValidacion {
  const diagnostico = new Diagnostico();
  const terminar = (nivel?: Nivel): ResultadoDeValidacion => ({
    errores: diagnostico.errores,
    advertencias: diagnostico.advertencias,
    nivel,
  });

  const json = fase1Parse(entrada.config, diagnostico);
  if (!json) return terminar();

  normalizarFormatoViejo(json, diagnostico);

  const contenido = fase2Schema(json, diagnostico);
  if (!contenido) return terminar();

  const mundo = entrada.mapa
    ? leerMapaTiled(entrada.mapa, diagnostico)
    : construirMundoSinMapa(contenido, diagnostico);
  if (diagnostico.hayErrores) return terminar();

  revisarEnlaces(contenido, entrada.minijuegos, diagnostico);
  if (diagnostico.hayErrores) return terminar();

  revisarCruce(contenido, mundo, entrada.mapa !== undefined, diagnostico);
  if (diagnostico.hayErrores) return terminar();

  return terminar({ contenido, mundo });
}

/** Devuelve una copia del JSON como objeto (para poder normalizarlo sin tocar el original). */
function fase1Parse(config: unknown, diagnostico: Diagnostico): Record<string, unknown> | undefined {
  let json = config;
  if (typeof json === 'string') {
    try {
      json = JSON.parse(json);
    } catch (error) {
      diagnostico.error(`parse: contenido JSON inválido: ${(error as Error).message}`);
      return undefined;
    }
  }
  if (typeof json !== 'object' || json === null || Array.isArray(json)) {
    diagnostico.error('parse: el contenido debe ser un objeto JSON');
    return undefined;
  }
  return structuredClone(json) as Record<string, unknown>;
}

function fase2Schema(json: Record<string, unknown>, diagnostico: Diagnostico): Contenido | undefined {
  const resultado = esquemaContenido.safeParse(json);
  if (resultado.success) return resultado.data;

  for (const problema of resultado.error.issues) {
    const ruta = rutaLegible(problema.path) || '(raíz)';
    diagnostico.error(`${ruta}: ${problema.message}`);
  }
  return undefined;
}
