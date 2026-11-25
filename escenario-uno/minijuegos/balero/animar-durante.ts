// Una animación hecha a mano: llama a una función en cada cuadro de la pantalla durante cierto tiempo,
// diciéndole qué tanto se ha avanzado. El balero la usa porque el cordón tiene que seguir al barrilito
// cuadro por cuadro, y eso no se puede hacer solo con CSS.

/**
 * Llama a `alAvanzar` en cada cuadro con el avance (de 0 a 1) y termina cuando llega a 1.
 * Si `senal` se dispara antes, deja de pedir cuadros y termina de inmediato.
 */
export function animarDurante(
  duracionEnMilisegundos: number,
  senal: AbortSignal,
  alAvanzar: (avance: number) => void,
): Promise<void> {
  return new Promise((terminar) => {
    if (senal.aborted) {
      terminar();
      return;
    }
    const inicio = performance.now();
    let cuadroPedido = requestAnimationFrame(dibujarCuadro);

    function dibujarCuadro(): void {
      const avance = Math.min(1, (performance.now() - inicio) / duracionEnMilisegundos);
      alAvanzar(avance);
      if (avance >= 1) {
        senal.removeEventListener('abort', alCerrar);
        terminar();
        return;
      }
      cuadroPedido = requestAnimationFrame(dibujarCuadro);
    }

    function alCerrar(): void {
      cancelAnimationFrame(cuadroPedido);
      terminar();
    }
    senal.addEventListener('abort', alCerrar, { once: true });
  });
}
