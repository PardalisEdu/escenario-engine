/**
 * DialogueRuntime (§10): el intérprete que ejecuta los pasos de un diálogo, uno tras otro.
 *
 * Cada paso es una promesa que termina cuando el paso terminó (la línea se descartó,
 * el minijuego se resolvió, la caminata llegó). El intérprete no sabe nada de Phaser:
 * le pide al mundo que haga cosas a través de la interfaz `AccionesDelMundo`.
 *
 * Reglas:
 * - Solo hay un diálogo activo a la vez. Si ya hay uno, los nuevos se ignoran (no hay cola).
 * - `abort()` termina el paso actual y libera todo; el host lo usa, por ejemplo, al abrir un menú.
 * - Una secuencia puede llamar a otra, hasta 8 niveles de profundidad.
 */
import type { AlVolver, Contenido, DestinoCamina, Linea, Opcion, Paso, PasosOSecuencia, Punto, Valor } from './esquema';
import type { GameState } from './estado';

/** Lo que devuelve un minijuego al terminar (§4.2). */
export interface MiniGameResult {
  exito: boolean;
  /** Valores que se aplican al estado, p. ej. { tortillas: true }. */
  otorgar?: Record<string, Valor>;
}

/**
 * Lo que el intérprete le pide al mundo. Cada promesa debe terminar cuando la acción terminó.
 * Todas reciben una señal de cancelación: si se aborta, deben limpiar y terminar.
 */
export interface AccionesDelMundo {
  mostrarLinea(linea: Linea, textoCompleto: string, cancelacion: AbortSignal): Promise<void>;
  /** Devuelve el índice de la opción elegida. */
  elegirOpcion(pregunta: string, opciones: Opcion[], cancelacion: AbortSignal): Promise<number>;
  reproducirEfecto(nombre: string, cancelacion: AbortSignal): Promise<void>;
  caminar(quien: string | undefined, destino: DestinoCamina, cancelacion: AbortSignal): Promise<void>;
  jugarMinijuego(clave: string, config: unknown, cancelacion: AbortSignal): Promise<MiniGameResult>;
  /** Lleva la cámara a un personaje (por id) o a un lugar (punto del mapa o coordenadas). */
  enfocar(objetivo: string | Punto, zoom: number, cancelacion: AbortSignal): Promise<void>;
  esperar(segundos: number, cancelacion: AbortSignal): Promise<void>;
  mostrarTitulo(texto: string, audio: string | undefined, cancelacion: AbortSignal): Promise<void>;
  hacerGesto(quien: string | undefined, gesto: string, cancelacion: AbortSignal): Promise<void>;
}

export type TipoDeInterlocutor = 'npcs' | 'interactivos';

const PROFUNDIDAD_MAXIMA_DE_SECUENCIAS = 8;

/** Datos que acompañan la ejecución de una lista de pasos. */
interface Contexto {
  cancelacion: AbortSignal;
  /** Cuántas secuencias anidadas llevamos. */
  profundidad: number;
  /** El alVolver del NPC con el que se habla, para usarlo después de un minijuego. */
  alVolver?: AlVolver;
}

export class DialogueRuntime {
  private cancelador?: AbortController;

  /** id del NPC o interactivo con el que se está hablando (si aplica). */
  idDelInterlocutor?: string;

  constructor(
    private readonly contenido: Contenido,
    private readonly estado: GameState,
    private readonly mundo: AccionesDelMundo,
  ) {}

  /** true mientras corre un diálogo. */
  get ocupado(): boolean {
    return this.cancelador !== undefined;
  }

  /**
   * Habla con un NPC o un interactivo: ejecuta la primera rama de su diálogo cuya condición se cumple.
   * Si ya hay un diálogo activo, no hace nada.
   */
  async hablarCon(tipo: TipoDeInterlocutor, id: string): Promise<void> {
    const interlocutor = this.contenido[tipo][id];
    if (!interlocutor) return;

    await this.ejecutarComoDialogo(id, async (cancelacion) => {
      const rama = interlocutor.dialogo.find((candidata) => this.estado.cumple(candidata.condicion));
      if (!rama) return;
      // Hablar con alguien marca su flag automático (§8.4, regla 3).
      this.estado.poner(`charlas.${id}`, true);
      await this.ejecutarPasos(rama.pasos, { cancelacion, profundidad: 0, alVolver: interlocutor.alVolver });
    });
  }

  /** Ejecuta pasos sueltos, por ejemplo "salida.siBloqueada". Si ya hay un diálogo activo, no hace nada. */
  async ejecutar(pasos: PasosOSecuencia): Promise<void> {
    await this.ejecutarComoDialogo(undefined, (cancelacion) =>
      this.ejecutarPasos(this.resolver(pasos), { cancelacion, profundidad: 0 }),
    );
  }

  /** Termina el paso actual y libera el diálogo. Una caminata abortada deja al personaje donde está. */
  abort(): void {
    this.cancelador?.abort(new DOMException('diálogo abortado', 'AbortError'));
  }

  private async ejecutarComoDialogo(
    idDelInterlocutor: string | undefined,
    tarea: (cancelacion: AbortSignal) => Promise<void>,
  ): Promise<void> {
    if (this.ocupado) return;

    const cancelador = new AbortController();
    this.cancelador = cancelador;
    this.idDelInterlocutor = idDelInterlocutor;
    try {
      await tarea(cancelador.signal);
    } catch (error) {
      // Abortar no es un error; cualquier otra cosa sí se reporta.
      if (!cancelador.signal.aborted) console.error('[escenario-engine]', error);
    } finally {
      this.cancelador = undefined;
      this.idDelInterlocutor = undefined;
    }
  }

  /** Una secuencia por nombre se convierte en sus pasos. */
  private resolver(pasos: PasosOSecuencia): Paso[] {
    if (typeof pasos === 'string') return this.contenido.secuencias[pasos] ?? [];
    return pasos;
  }

  private async ejecutarPasos(pasos: Paso[], contexto: Contexto): Promise<void> {
    if (contexto.profundidad > PROFUNDIDAD_MAXIMA_DE_SECUENCIAS) {
      throw new Error(`se excedió la profundidad máxima de secuencias (${PROFUNDIDAD_MAXIMA_DE_SECUENCIAS})`);
    }
    for (const paso of pasos) {
      contexto.cancelacion.throwIfAborted();
      await this.ejecutarPaso(paso, contexto);
    }
  }

  private async ejecutarPaso(paso: Paso, contexto: Contexto): Promise<void> {
    const { cancelacion } = contexto;
    const dentroDeOtraSecuencia = { ...contexto, profundidad: contexto.profundidad + 1 };

    switch (paso.tipo) {
      case 'linea': {
        const texto = this.estado.completarTexto(paso.texto);
        await esperarOCancelar(this.mundo.mostrarLinea(paso, texto, cancelacion), cancelacion);
        break;
      }

      case 'elige': {
        const opcionesVisibles = paso.opciones.filter((opcion) => this.estado.cumple(opcion.condicion));
        if (opcionesVisibles.length === 0) break;
        const pregunta = this.estado.completarTexto(paso.pregunta);
        const indice = await esperarOCancelar(this.mundo.elegirOpcion(pregunta, opcionesVisibles, cancelacion), cancelacion);
        await this.ejecutarPasos(this.resolver(opcionesVisibles[indice]!.pasos), dentroDeOtraSecuencia);
        break;
      }

      case 'efecto':
        await esperarOCancelar(this.mundo.reproducirEfecto(paso.nombre, cancelacion), cancelacion);
        break;

      case 'pon':
        this.estado.ponerVarios(paso.valores);
        break;

      case 'juego': {
        const resultado = await esperarOCancelar(this.mundo.jugarMinijuego(paso.clave, paso.config, cancelacion), cancelacion);
        this.estado.ponerVarios(resultado.otorgar);
        if (contexto.alVolver) await this.ejecutarAlVolver(contexto.alVolver, dentroDeOtraSecuencia);
        break;
      }

      case 'camina':
        await esperarOCancelar(this.mundo.caminar(paso.quien, paso.destino, cancelacion), cancelacion);
        break;

      case 'secuencia':
        await this.ejecutarPasos(this.resolver(paso.nombre), dentroDeOtraSecuencia);
        break;

      case 'condicional':
        if (this.estado.cumple(paso.condicion)) await this.ejecutarPasos(paso.pasos, contexto);
        break;

      case 'enfoca':
        await esperarOCancelar(this.mundo.enfocar(paso.objetivo, paso.zoom, cancelacion), cancelacion);
        break;

      case 'espera':
        await esperarOCancelar(this.mundo.esperar(paso.segundos, cancelacion), cancelacion);
        break;

      case 'titulo': {
        const texto = this.estado.completarTexto(paso.texto);
        await esperarOCancelar(this.mundo.mostrarTitulo(texto, paso.audio, cancelacion), cancelacion);
        break;
      }

      case 'gesto':
        await esperarOCancelar(this.mundo.hacerGesto(paso.quien, paso.nombre, cancelacion), cancelacion);
        break;
    }
  }

  /** Tras un minijuego: si el estado tiene los ítems de conItem → siLogrado; si no → siNo (§8.5). */
  private async ejecutarAlVolver(alVolver: AlVolver, contexto: Contexto): Promise<void> {
    const logrado = alVolver.conItem.every((item) => Boolean(this.estado.valorDe(item)));
    const pasos = logrado ? alVolver.siLogrado : alVolver.siNo;
    // Los pasos de alVolver no vuelven a disparar alVolver.
    await this.ejecutarPasos(this.resolver(pasos), { ...contexto, alVolver: undefined });
  }
}

/** Espera la promesa, pero termina de inmediato (con error) si llega la cancelación. */
function esperarOCancelar<T>(promesa: Promise<T>, cancelacion: AbortSignal): Promise<T> {
  return new Promise<T>((resolver, rechazar) => {
    if (cancelacion.aborted) {
      rechazar(cancelacion.reason);
      return;
    }
    const alCancelar = () => rechazar(cancelacion.reason);
    cancelacion.addEventListener('abort', alCancelar, { once: true });
    promesa
      .then(resolver, rechazar)
      .finally(() => cancelacion.removeEventListener('abort', alCancelar));
  });
}
