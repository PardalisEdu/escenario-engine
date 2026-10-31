/**
 * Condiciones del diálogo (§8.4). Son datos, nunca código: no se evalúa JavaScript.
 *
 *   "tengo tortillas"          el objetivo o variable "tortillas" tiene un valor verdadero
 *   "no tengo limones"         negación; "no" sirve delante de cualquier condición ("no globo")
 *   "objetivosCompletos"       todos los objetivos están cumplidos
 *   "globo"                    la variable "globo" tiene un valor verdadero
 *   "charlas.tortu"            ya se habló con el NPC "tortu" (el motor lo marca solo)
 *   ["a", "b"]                 se cumplen a Y b
 *   { "alguno": ["a", "b"] }   se cumple a O b
 */
import type { Condicion, DeclaracionDeEstado, Valor } from './esquema';

/** Lo mínimo que necesita una condición para evaluarse. */
export interface ConsultaDeEstado {
  valorDe(nombre: string): Valor | undefined;
  readonly objetivosCompletos: boolean;
}

const PREFIJO_NEGACION = 'no ';
const PREFIJO_TENGO = 'tengo ';
const TODOS_LOS_OBJETIVOS = 'objetivosCompletos';

/** Quita espacios sobrantes: "  tengo   tortillas " → "tengo tortillas". */
function limpiar(texto: string): string {
  return texto.trim().replace(/\s+/g, ' ');
}

/** "tengo tortillas" → "tortillas"; "globo" → "globo". */
function nombreDeVariable(texto: string): string {
  if (texto.startsWith(PREFIJO_TENGO)) return texto.slice(PREFIJO_TENGO.length);
  return texto;
}

export function cumpleCondicion(condicion: Condicion, estado: ConsultaDeEstado): boolean {
  if (Array.isArray(condicion)) {
    return condicion.every((parte) => cumpleCondicion(parte, estado));
  }
  if (typeof condicion === 'object') {
    return condicion.alguno.some((parte) => cumpleCondicion(parte, estado));
  }

  const texto = limpiar(condicion);
  if (texto.startsWith(PREFIJO_NEGACION)) {
    return !cumpleCondicion(texto.slice(PREFIJO_NEGACION.length), estado);
  }
  if (texto === TODOS_LOS_OBJETIVOS) {
    return estado.objetivosCompletos;
  }
  return Boolean(estado.valorDe(nombreDeVariable(texto)));
}

/** Los nombres de objetivos o variables que menciona una condición (para validarlos). */
export function nombresUsados(condicion: Condicion): string[] {
  if (Array.isArray(condicion)) {
    return condicion.flatMap(nombresUsados);
  }
  if (typeof condicion === 'object') {
    return condicion.alguno.flatMap(nombresUsados);
  }

  const texto = limpiar(condicion);
  if (texto.startsWith(PREFIJO_NEGACION)) {
    return nombresUsados(texto.slice(PREFIJO_NEGACION.length));
  }
  if (texto === TODOS_LOS_OBJETIVOS) {
    return [];
  }
  return [nombreDeVariable(texto)];
}

/**
 * ¿El nombre está declarado en "estado"? Vale si es un objetivo, una variable,
 * "dinero" (cuando hay dinero inicial) o si coincide con un comodín como "charlas.*".
 */
export function estaDeclarado(nombre: string, estado: DeclaracionDeEstado): boolean {
  if (estado.objetivos.includes(nombre)) return true;
  if (estado.variables.includes(nombre)) return true;
  if (nombre === 'dinero' && estado.dinero !== undefined) return true;

  for (const variable of estado.variables) {
    const esComodin = variable.endsWith('.*');
    const prefijo = variable.slice(0, -1); // "charlas.*" → "charlas."
    if (esComodin && nombre.startsWith(prefijo)) return true;
  }
  return false;
}
