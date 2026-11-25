// Un «aviso»: una promesa que termina cuando el minijuego avisa que algo ya pasó (por ejemplo, que el jugador
// tocó la lechuga buena). Si el motor cierra el minijuego antes, termina sola: así ninguna fase se queda colgada.

export interface Aviso<Valor> {
  /** Termina cuando se llama a `avisar`, o cuando el motor cierra el minijuego. */
  readonly promesa: Promise<Valor>;
  /** Termina la promesa con ese valor. Solo cuenta la primera vez. */
  avisar(valor: Valor): void;
}

/** `valorSiSeCierra` es con lo que termina la promesa si el motor cierra el minijuego antes del aviso. */
export function crearAviso<Valor>(senal: AbortSignal, valorSiSeCierra: Valor): Aviso<Valor> {
  let terminarLaPromesa: (valor: Valor) => void = () => {};
  const promesa = new Promise<Valor>((terminar) => {
    terminarLaPromesa = terminar;
  });

  const alCerrar = (): void => terminarLaPromesa(valorSiSeCierra);
  if (senal.aborted) {
    alCerrar();
  } else {
    senal.addEventListener('abort', alCerrar, { once: true });
  }

  return {
    promesa,
    avisar(valor) {
      senal.removeEventListener('abort', alCerrar);
      terminarLaPromesa(valor);
    },
  };
}
