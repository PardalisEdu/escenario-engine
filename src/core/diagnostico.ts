/**
 * Acumula los errores y advertencias que encuentra la validación.
 *
 * - Un error detiene el arranque del nivel.
 * - Una advertencia solo se muestra en consola (por ejemplo, formatos viejos que siguen funcionando).
 */
export class Diagnostico {
  readonly errores: string[] = [];
  readonly advertencias: string[] = [];

  error(mensaje: string): void {
    this.errores.push(mensaje);
  }

  advertencia(mensaje: string): void {
    this.advertencias.push(mensaje);
  }

  get hayErrores(): boolean {
    return this.errores.length > 0;
  }
}
