/**
 * Comentarios del jugador (§8.6): frases como «¡Qué colorido!» que dice al entrar en una
 * zonaComentario del mapa. Se elige una al azar del grupo de la zona.
 *
 * Reglas:
 *   - Solo al entrar a la zona, no mientras se está dentro.
 *   - Cada zona espera su "cooldown" (20 s por defecto) antes de volver a comentar.
 *   - Nunca interrumpen un diálogo.
 */
import type { Linea, Punto } from '../../core/esquema';
import { puntoDentroDeForma } from '../../core/geometria';
import type { ZonaDeComentario } from '../../core/mundo';

export class ComentariosPorZona {
  /** Índices de las zonas donde está el jugador ahora. */
  private readonly zonasOcupadas = new Set<number>();
  /** Índice de zona → momento (ms) de su último comentario. */
  private readonly ultimoComentario = new Map<number, number>();

  constructor(
    private readonly zonas: ZonaDeComentario[],
    private readonly comentarios: Record<string, Linea[]>,
    /** Número al azar entre 0 y 1 (con semilla en pruebas E2E). */
    private readonly azar: () => number,
    private readonly decir: (linea: Linea) => void,
  ) {}

  /**
   * Se llama en cada cuadro.
   * @param sePuedeComentar false si hay un diálogo o ya se está diciendo otro comentario
   */
  actualizar(posicionDelJugador: Punto, ahoraEnMilisegundos: number, sePuedeComentar: boolean): void {
    if (!sePuedeComentar) return;

    this.zonas.forEach((zona, indice) => {
      const estaDentro = puntoDentroDeForma(posicionDelJugador, zona.forma);
      if (!estaDentro) {
        this.zonasOcupadas.delete(indice);
        return;
      }

      const acabaDeEntrar = !this.zonasOcupadas.has(indice);
      if (!acabaDeEntrar) return;
      this.zonasOcupadas.add(indice);

      const ultimo = this.ultimoComentario.get(indice);
      const yaPasoLaEspera = ultimo === undefined || ahoraEnMilisegundos - ultimo >= zona.esperaEnSegundos * 1000;
      if (!yaPasoLaEspera) return;

      const linea = this.elegirAlAzar(zona.grupo);
      if (linea) {
        this.ultimoComentario.set(indice, ahoraEnMilisegundos);
        this.decir(linea);
      }
    });
  }

  private elegirAlAzar(grupo: string): Linea | undefined {
    const lineas = this.comentarios[grupo] ?? [];
    return lineas[Math.floor(this.azar() * lineas.length)];
  }
}
