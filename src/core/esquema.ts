// Schema del JSON de contenido (§8). Fase 2 del pipeline de validación.
import { z } from 'zod';

z.config(z.locales.es());

export type Valor = string | number | boolean;
export type Condicion = string | Condicion[] | { alguno: Condicion[] };
export type Mira = 'izquierda' | 'derecha';
export interface Vec { x: number; y: number }

export interface Linea {
  dice: string;
  texto: string;
  trad?: string;
  en?: string;
  es?: string;
  audio?: string;
}
export interface Opcion {
  texto?: string;
  trad?: string;
  imagen?: string;
  audio?: string;
  cuando?: Condicion;
  secuencia: Paso[] | string;
}
export type Paso =
  | Linea
  | { elige: string; opciones: Opcion[] }
  | { efecto: string }
  | { pon: Record<string, Valor> }
  | { juego: string; config?: unknown }
  | { camina: number | string | Vec; quien?: string }
  | { secuencia: string }
  | { cuando: Condicion; dice: Paso[] };

const valor = z.union([z.string(), z.number(), z.boolean()]);
const vec = z.object({ x: z.number(), y: z.number() });

export const condicion: z.ZodType<Condicion> = z.lazy(() =>
  z.union([z.string().min(1), z.array(condicion), z.strictObject({ alguno: z.array(condicion).min(1) })]),
);

const linea = z.object({
  dice: z.string(),
  texto: z.string(),
  trad: z.string().optional(),
  en: z.string().optional(),
  es: z.string().optional(),
  audio: z.string().optional(),
});

const pasos = z.lazy(() => z.array(paso));
const pasosORef = z.lazy(() => z.union([z.string(), z.array(paso)]));

const esquemasPaso = {
  cuando: z.object({ cuando: condicion, dice: pasos }),
  elige: z.object({
    elige: z.string(),
    opciones: z.array(z.object({
      texto: z.string().optional(),
      trad: z.string().optional(),
      imagen: z.string().optional(),
      audio: z.string().optional(),
      cuando: condicion.optional(),
      secuencia: pasosORef,
    })).min(1),
  }),
  juego: z.object({ juego: z.string(), config: z.unknown().optional() }),
  camina: z.object({ camina: z.union([z.number(), z.string(), vec]), quien: z.string().optional() }),
  secuencia: z.object({ secuencia: z.string() }),
  efecto: z.object({ efecto: z.string() }),
  pon: z.object({ pon: z.record(z.string(), valor) }),
  dice: linea,
} as const;
// El orden importa: un condicional también trae "dice" (su cuerpo).
export const CLAVES_PASO = Object.keys(esquemasPaso) as (keyof typeof esquemasPaso)[];

export const clavePaso = (p: object) => CLAVES_PASO.find((k) => k in p);

// Cada paso tiene una sola intención, elegida por su clave distintiva (§8.3).
export const paso: z.ZodType<Paso> = z.unknown().superRefine((v, ctx) => {
  const clave = v && typeof v === 'object' && !Array.isArray(v) ? clavePaso(v) : undefined;
  if (!clave) {
    ctx.addIssue({ code: 'custom', message: `paso sin intención: se espera una clave entre ${CLAVES_PASO.join(', ')}` });
    return;
  }
  const r = esquemasPaso[clave].safeParse(v);
  if (!r.success) for (const i of r.error.issues) ctx.addIssue({ ...i, path: i.path } as never);
}) as never;

const animaciones = z.object({ idle: z.string().optional(), caminar: z.string().optional(), hablar: z.string().optional() });

const rama = z.object({ cuando: condicion.optional(), dice: z.array(paso) });

const alVolver = z.object({
  conItem: z.union([z.string(), z.array(z.string()).min(1)]),
  siLogrado: pasosORef,
  siNo: pasosORef,
});

const formaLegacy = z.object({ tipo: z.literal('rect'), w: z.number(), h: z.number() });

const npc = z.object({
  dialogo: z.array(rama),
  alVolver: alVolver.optional(),
  // legacy (sin mapa)
  x: z.number().optional(),
  y: z.number().optional(),
  radio: z.number().optional(),
  forma: formaLegacy.optional(),
  props: z.array(z.looseObject({ tipo: z.string() })).optional(),
});

export const contenido = z.object({
  meta: z.object({
    id: z.string().min(1),
    titulo: z.string(),
    personajes: z.record(z.string(), z.object({
      idioma: z.enum(['es', 'en']),
      sprite: z.string(),
      velocidad: z.number().positive().optional(),
      animaciones: animaciones.optional(),
    })),
  }),
  jugador: z.object({
    personaje: z.string(),
    animaciones: animaciones.optional(),
    velocidadX: z.number().positive().default(240),
    velocidadY: z.number().positive().default(110),
    radioAviso: z.number().positive().default(160),
  }).optional(),
  mundo: z.object({
    logico: z.tuple([z.number().positive(), z.number().positive()]).default([1280, 720]),
    fondo: z.string().optional(),
    camara: z.object({
      modo: z.enum(['follow', 'rails', 'pan']).default('follow'),
      zonaMuerta: z.number().nonnegative().default(280),
      suavizado: z.number().min(0).max(1).default(0.1),
      seguirY: z.number().min(0).max(1).default(0.04),
      inercia: z.number().min(0).max(1).default(0.92),
      rebote: z.number().min(0).default(0.05),
      enfoques: z.array(z.object({ x: z.number(), y: z.number().optional(), zoom: z.number().optional() })).optional(),
    }).prefault({}),
    sonidos: z.object({ tap: z.string().optional(), cerca: z.string().optional(), musica: z.string().optional() }).optional(),
    // legacy (sin mapa)
    ancho: z.number().positive().optional(),
    alto: z.number().positive().optional(),
    piso: z.tuple([z.number(), z.number()]).optional(),
    inicio: z.number().optional(),
    capas: z.array(z.object({ asset: z.string(), parallax: z.number().default(1), depth: z.number().default(0) })).optional(),
  }).prefault({}),
  estado: z.object({
    objetivos: z.array(z.string()).default([]),
    variables: z.array(z.string()).default([]),
    lista: z.record(z.string(), z.string()).optional(),
    dinero: z.number().optional(),
  }).prefault({}),
  secuencias: z.record(z.string(), z.array(paso)).default({}),
  npcs: z.record(z.string(), npc).default({}),
  interactivos: z.record(z.string(), npc).default({}),
  comentarios: z.record(z.string(), z.array(linea)).default({}),
  salida: z.object({
    destino: z.string(),
    requiere: condicion.optional(),
    siBloqueada: pasosORef.optional(),
    flecha: z.object({ visibleCuando: condicion.optional(), texto: z.string().optional() }).optional(),
    x: z.number().optional(), // legacy
  }).optional(),
  layout: z.array(z.looseObject({ tipo: z.string() })).optional(), // legacy
});

export type Contenido = z.output<typeof contenido>;
export type Npc = z.output<typeof npc>;
export type AlVolver = z.output<typeof alVolver>;
export type Personaje = Contenido['meta']['personajes'][string];

export const rutaZod = (path: PropertyKey[]) =>
  path.reduce<string>((s, k) => (typeof k === 'number' ? `${s}[${k}]` : s ? `${s}.${String(k)}` : String(k)), '');
