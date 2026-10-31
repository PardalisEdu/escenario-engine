/**
 * GameState (§8.2): los objetivos, variables y flags de un nivel mientras se juega.
 */
import { cumpleCondicion, type ConsultaDeEstado } from './condiciones';
import type { Condicion, DeclaracionDeEstado, Valor } from './esquema';

export class GameState implements ConsultaDeEstado {
  /** Todos los valores actuales: objetivos, variables y flags como "charlas.tortu". Sin prototipo para evitar colisiones como "constructor". */
  readonly valores: Record<string, Valor> = Object.create(null) as Record<string, Valor>;

  /** Se llama cuando un objetivo pasa de no cumplido a cumplido. */
  alCompletarObjetivo?: (objetivo: string) => void;

  /** Se llama después de cualquier cambio (por ejemplo, para mostrar u ocultar la flecha de salida). */
  alCambiar?: () => void;

  constructor(
    private readonly declaracion: DeclaracionDeEstado,
    valoresGuardados: Record<string, Valor> = {},
  ) {
    if (declaracion.dinero !== undefined) {
      this.valores.dinero = declaracion.dinero;
    }
    for (const [clave, valor] of Object.entries(valoresGuardados)) {
      if (clave === '__proto__') continue;
      if (typeof valor === 'string' || typeof valor === 'number' || typeof valor === 'boolean') {
        this.valores[clave] = valor;
      }
    }
  }

  valorDe(nombre: string): Valor | undefined {
    return Object.hasOwn(this.valores, nombre) ? this.valores[nombre] : undefined;
  }

  poner(nombre: string, valor: Valor): void {
    if (nombre === '__proto__') return;
    const yaEstabaCumplido = Boolean(this.valorDe(nombre));
    this.valores[nombre] = valor;

    const esObjetivo = this.declaracion.objetivos.includes(nombre);
    if (esObjetivo && !yaEstabaCumplido && valor) {
      this.alCompletarObjetivo?.(nombre);
    }
    this.alCambiar?.();
  }

  ponerVarios(cambios: Record<string, Valor> = {}): void {
    for (const [nombre, valor] of Object.entries(cambios)) {
      this.poner(nombre, valor);
    }
  }

  get objetivosCompletos(): boolean {
    return this.declaracion.objetivos.every((objetivo) => Boolean(this.valores[objetivo]));
  }

  /** Una condición ausente siempre se cumple. */
  cumple(condicion: Condicion | undefined): boolean {
    if (condicion === undefined) return true;
    return cumpleCondicion(condicion, this);
  }

  /** Los objetivos pendientes, en español: «las tortillas, los aguacates y los limones». */
  objetivosQueFaltan(): string {
    const nombres = this.declaracion.objetivos
      .filter((objetivo) => !this.valores[objetivo])
      .map((objetivo) => this.declaracion.lista?.[objetivo] ?? objetivo);

    if (nombres.length === 0) return '';
    if (nombres.length === 1) return nombres[0]!;
    const todosMenosElUltimo = nombres.slice(0, -1).join(', ');
    const ultimo = nombres[nombres.length - 1];
    return `${todosMenosElUltimo} y ${ultimo}`;
  }

  /** Reemplaza {faltan} y {dinero} dentro de un texto de diálogo. */
  completarTexto(texto: string): string {
    return texto
      .replaceAll('{faltan}', this.objetivosQueFaltan())
      .replaceAll('{dinero}', String(this.valores.dinero ?? 0));
  }
}
