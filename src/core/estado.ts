// GameState (§8.2), gramática de condiciones (§8.4) y SaveBlob (§11).
import type { Condicion, Contenido, Mira, Valor } from './esquema';

// --- Condiciones: se compilan, nunca se evalúa código ---

type Nodo =
  | { op: 'ref'; nombre: string }
  | { op: 'todos' }
  | { op: 'no'; de: Nodo }
  | { op: 'y' | 'o'; de: Nodo[] };

export function compilar(c: Condicion): Nodo {
  if (Array.isArray(c)) return { op: 'y', de: c.map(compilar) };
  if (typeof c === 'object') return { op: 'o', de: c.alguno.map(compilar) };
  const s = c.trim().replace(/\s+/g, ' ');
  if (s.startsWith('no ')) return { op: 'no', de: compilar(s.slice(3)) };
  if (s.startsWith('tengo ')) return { op: 'ref', nombre: s.slice(6) };
  if (s === 'objetivosCompletos') return { op: 'todos' };
  return { op: 'ref', nombre: s };
}

export function referencias(c: Condicion): string[] {
  const n = compilar(c);
  const out: string[] = [];
  const walk = (n: Nodo): void => {
    if (n.op === 'ref') out.push(n.nombre);
    else if (n.op === 'no') walk(n.de);
    else if (n.op === 'y' || n.op === 'o') n.de.forEach(walk);
  };
  walk(n);
  return out;
}

/** ¿El nombre está declarado en estado (objetivos, variables o comodín "x.*")? */
export function declarado(nombre: string, estado: Contenido['estado']): boolean {
  if (estado.objetivos.includes(nombre) || estado.variables.includes(nombre)) return true;
  if (nombre === 'dinero' && estado.dinero !== undefined) return true;
  return estado.variables.some((v) => v.endsWith('.*') && nombre.startsWith(v.slice(0, -1)));
}

// --- Estado ---

export class GameState {
  valores: Record<string, Valor> = {};
  /** Se llama cuando un objetivo pasa a truthy. */
  onObjetivo?: (id: string) => void;
  onCambio?: () => void;

  constructor(private decl: Contenido['estado'], guardado?: Record<string, Valor>) {
    if (decl.dinero !== undefined) this.valores.dinero = decl.dinero;
    Object.assign(this.valores, guardado);
  }

  get(k: string): Valor | undefined {
    return this.valores[k];
  }

  set(k: string, v: Valor) {
    const antes = !!this.valores[k];
    this.valores[k] = v;
    if (!antes && v && this.decl.objetivos.includes(k)) this.onObjetivo?.(k);
    this.onCambio?.();
  }

  aplicar(cambios: Record<string, Valor> = {}) {
    for (const [k, v] of Object.entries(cambios)) this.set(k, v);
  }

  get objetivosCompletos() {
    return this.decl.objetivos.every((o) => !!this.valores[o]);
  }

  cumple(c: Condicion | undefined): boolean {
    if (c === undefined) return true;
    const ev = (n: Nodo): boolean => {
      switch (n.op) {
        case 'ref': return !!this.valores[n.nombre];
        case 'todos': return this.objetivosCompletos;
        case 'no': return !ev(n.de);
        case 'y': return n.de.every(ev);
        case 'o': return n.de.some(ev);
      }
    };
    return ev(compilar(c));
  }

  /** «las tortillas, los aguacates y los limones» */
  faltan(): string {
    const items = this.decl.objetivos.filter((o) => !this.valores[o]).map((o) => this.decl.lista?.[o] ?? o);
    return items.length < 2 ? (items[0] ?? '') : `${items.slice(0, -1).join(', ')} y ${items.at(-1)}`;
  }

  interpolar(texto: string): string {
    return texto.replace('{faltan}', () => this.faltan()).replace('{dinero}', () => String(this.valores.dinero ?? 0));
  }
}

// --- Persistencia ---

export interface SaveBlob {
  v: 2;
  nivel: string;
  estado: Record<string, Valor>;
  momento?: { jugador?: { x: number; y: number; mira: Mira }; camara?: { x: number }; tiempo?: number };
}

/** Acepta string o objeto; migra v1 → v2 (el jugador aparece en inicioJugador). */
export function leerSave(save: string | SaveBlob | object | undefined | null, nivel: string): SaveBlob | undefined {
  if (!save) return undefined;
  const blob = (typeof save === 'string' ? JSON.parse(save) : save) as { v?: number; estado?: Record<string, Valor> };
  if (blob.v === 2) return blob as SaveBlob;
  // ponytail: no hay migraciones por versión de schema del contenido todavía; se agregan aquí cuando existan.
  return { v: 2, nivel, estado: blob.estado ?? {} };
}
