// DialogueRuntime (§10): intérprete de pasos como corutina. No conoce Phaser; habla con un Escenario.
import { clavePaso, type Contenido, type Linea, type Opcion, type Paso, type Valor, type Vec } from './esquema';
import type { GameState } from './estado';

export interface MiniGameResult { exito: boolean; otorgar?: Record<string, Valor> }

/** Lo que el intérprete necesita del mundo. Cada promesa termina cuando el paso terminó. */
export interface Escenario {
  linea(l: Linea, texto: string, signal: AbortSignal): Promise<void>;
  elegir(pregunta: string, opciones: Opcion[], signal: AbortSignal): Promise<number>;
  efecto(nombre: string, signal: AbortSignal): Promise<void>;
  camina(quien: string | undefined, destino: number | string | Vec, signal: AbortSignal): Promise<void>;
  juego(clave: string, config: unknown, signal: AbortSignal): Promise<MiniGameResult>;
}

const PROFUNDIDAD_MAX = 8;

const conAbort = <T>(p: Promise<T>, s: AbortSignal) => new Promise<T>((res, rej) => {
  if (s.aborted) return rej(s.reason);
  const alAbortar = () => rej(s.reason);
  s.addEventListener('abort', alAbortar, { once: true });
  p.then(res, rej).finally(() => s.removeEventListener('abort', alAbortar));
});

export class DialogueRuntime {
  private ctrl?: AbortController;
  /** id del NPC o interactivo con el que se habla, si aplica. */
  enCurso?: string;

  constructor(private c: Contenido, private estado: GameState, private esc: Escenario) {}

  get activo() { return !!this.ctrl; }

  /** Ejecuta la primera rama que cumple. Devuelve false si ya hay un diálogo activo (sin colas). */
  hablar(tipo: 'npcs' | 'interactivos', id: string): Promise<boolean> | false {
    const def = this.c[tipo][id];
    if (!def) return Promise.resolve(true);
    return this.correr(id, async (s) => {
      const rama = def.dialogo.find((r) => this.estado.cumple(r.cuando));
      if (!rama) return;
      this.estado.set(`charlas.${id}`, true);
      await this.pasos(rama.dice, s, 0, def.alVolver);
    });
  }

  /** Ejecuta pasos sueltos (p. ej. salida.siBloqueada). */
  ejecutar(pasos: Paso[] | string): Promise<boolean> | false {
    return this.correr(undefined, (s) => this.pasos(this.resolver(pasos), s, 0));
  }

  /** Termina el paso actual y libera limpio. */
  abort() {
    this.ctrl?.abort(new DOMException('abortado', 'AbortError'));
  }

  private correr(id: string | undefined, fn: (s: AbortSignal) => Promise<void>): Promise<boolean> | false {
    if (this.ctrl) return false;
    const ctrl = (this.ctrl = new AbortController());
    this.enCurso = id;
    return fn(ctrl.signal)
      .then(() => true, (e) => {
        if (!ctrl.signal.aborted) console.error('[escenario-engine]', e);
        return true;
      })
      .finally(() => { this.ctrl = undefined; this.enCurso = undefined; });
  }

  private resolver(x: Paso[] | string): Paso[] {
    return typeof x === 'string' ? this.c.secuencias[x] ?? [] : x;
  }

  private async pasos(pasos: Paso[], s: AbortSignal, prof: number, alVolver?: Contenido['npcs'][string]['alVolver']): Promise<void> {
    if (prof > PROFUNDIDAD_MAX) throw new Error(`se excedió la profundidad máxima de secuencias (${PROFUNDIDAD_MAX})`);
    for (const p of pasos) {
      s.throwIfAborted();
      const q = p as any;
      switch (clavePaso(p)) {
        case 'cuando':
          if (this.estado.cumple(q.cuando)) await this.pasos(q.dice, s, prof, alVolver);
          break;
        case 'elige': {
          const visibles = (q.opciones as Opcion[]).filter((o) => this.estado.cumple(o.cuando));
          if (!visibles.length) break;
          const i = await conAbort(this.esc.elegir(this.estado.interpolar(q.elige), visibles, s), s);
          await this.pasos(this.resolver(visibles[i]!.secuencia), s, prof + 1, alVolver);
          break;
        }
        case 'efecto': await conAbort(this.esc.efecto(q.efecto, s), s); break;
        case 'pon': this.estado.aplicar(q.pon); break;
        case 'juego': {
          const r = await conAbort(this.esc.juego(q.juego, q.config, s), s);
          this.estado.aplicar(r.otorgar);
          if (alVolver) {
            const logrado = [alVolver.conItem].flat().every((k) => !!this.estado.get(k));
            await this.pasos(this.resolver(logrado ? alVolver.siLogrado : alVolver.siNo), s, prof + 1);
          }
          break;
        }
        case 'camina': await conAbort(this.esc.camina(q.quien, q.camina, s), s); break;
        case 'secuencia': await this.pasos(this.resolver(q.secuencia), s, prof + 1, alVolver); break;
        case 'dice': await conAbort(this.esc.linea(p as Linea, this.estado.interpolar(q.texto), s), s); break;
      }
    }
  }
}
