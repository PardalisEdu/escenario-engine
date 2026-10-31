/**
 * Cómo sigue el acompañante al jugador: como con una correa.
 *
 * Mientras esté a menos de `distancia` del jugador, se queda quieto mirándolo.
 * Si el jugador se aleja, camina hasta quedar a `distancia` de él, del lado donde ya estaba,
 * así no cruza de un lado a otro cada vez que el jugador se voltea.
 *
 * Un paso "camina" con "quien" igual al acompañante lo guía: mientras dura, deja de seguir.
 *
 * Limitación conocida: no hay búsqueda de caminos (§18, pregunta 1). Si un puesto queda entre los dos,
 * el acompañante se desliza por el borde y puede quedarse atrás hasta que el jugador regrese.
 */
import type { Punto } from '../../core/esquema';
import { ajustarAlPiso, distancia } from '../../core/geometria';
import type { Actor } from './actor';

/** Holgura antes de empezar a caminar, para que no dé pasitos con cada movimiento del jugador. */
const HOLGURA_PARA_ARRANCAR = 40;

export class SeguimientoDelAcompanante {
  /** true mientras un paso "camina" lo lleva a otro lado. */
  guiado = false;

  constructor(
    readonly actor: Actor,
    private readonly distanciaAlJugador: number,
    private readonly pisos: Punto[][],
  ) {}

  /** Se llama en cada cuadro, antes de `actor.actualizar`. */
  actualizar(jugador: Actor): void {
    if (this.guiado) return;

    const separacion = distancia(this.actor.posicion, jugador.posicion);
    const estaCerca = separacion <= this.distanciaAlJugador + HOLGURA_PARA_ARRANCAR;

    if (!this.actor.caminando) {
      if (estaCerca) {
        this.mirarAlJugador(jugador);
        return;
      }
      this.actor.caminarA(this.lugarJuntoAlJugador(jugador, separacion));
      return;
    }
    this.actor.cambiarDestino(this.lugarJuntoAlJugador(jugador, separacion));
  }

  /** El punto a `distancia` del jugador sobre la línea que los une, del lado del acompañante. */
  private lugarJuntoAlJugador(jugador: Actor, separacion: number): Punto {
    if (separacion === 0) return jugador.posicion;
    const proporcion = this.distanciaAlJugador / separacion;
    const lugar = {
      x: jugador.posicion.x + (this.actor.posicion.x - jugador.posicion.x) * proporcion,
      y: jugador.posicion.y + (this.actor.posicion.y - jugador.posicion.y) * proporcion,
    };
    return ajustarAlPiso(lugar, this.pisos);
  }

  private mirarAlJugador(jugador: Actor): void {
    const jugadorALaIzquierda = jugador.posicion.x < this.actor.posicion.x;
    this.actor.mirarHacia(jugadorALaIzquierda ? 'izquierda' : 'derecha');
  }
}
