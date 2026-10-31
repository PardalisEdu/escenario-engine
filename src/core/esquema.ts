/**
 * Esquema del JSON de contenido de un nivel (§8 de la spec) y los tipos que usa el motor.
 *
 * Quien escribe un nivel usa claves cortas, pensadas para escribirse a mano. Al validar,
 * cada paso se convierte en un objeto con un campo `tipo`, para que el resto del motor
 * pueda hacer `switch (paso.tipo)` en vez de adivinar qué clase de paso es:
 *
 *   En el JSON del nivel                          Dentro del motor
 *   { "dice": "tortu", "texto": "Hola" }          { tipo: 'linea', hablante: 'tortu', texto: 'Hola' }
 *   { "elige": "¿Cuál?", "opciones": [...] }      { tipo: 'elige', pregunta: '¿Cuál?', opciones: [...] }
 *   { "efecto": "magia" }                         { tipo: 'efecto', nombre: 'magia' }
 *   { "pon": { "globo": "rosa" } }                { tipo: 'pon', valores: { globo: 'rosa' } }
 *   { "juego": "Tortilleria", "config": {...} }   { tipo: 'juego', clave: 'Tortilleria', config: {...} }
 *   { "camina": "frente", "quien": "tortu" }      { tipo: 'camina', destino: 'frente', quien: 'tortu' }
 *   { "secuencia": "aun_no_item" }                { tipo: 'secuencia', nombre: 'aun_no_item' }
 *   { "cuando": "tengo x", "dice": [...] }        { tipo: 'condicional', condicion: 'tengo x', pasos: [...] }
 *   { "enfoca": "tortu", "zoom": 1.3 }            { tipo: 'enfoca', objetivo: 'tortu', zoom: 1.3 }
 *   { "espera": 1.5 }                             { tipo: 'espera', segundos: 1.5 }
 *   { "titulo": "La Tortillería" }                { tipo: 'titulo', texto: 'La Tortillería' }
 *   { "gesto": "saltar", "quien": "tortu" }       { tipo: 'gesto', nombre: 'saltar', quien: 'tortu' }
 *
 * Las ramas de un diálogo también se renombran: { "cuando", "dice": [...] } → { condicion, pasos }.
 * Los mensajes de error siempre usan los nombres del JSON, que son los que conoce quien escribe.
 */
import { z } from 'zod';

z.config(z.locales.es());

// ─── Tipos básicos ───────────────────────────────────────────────────────────

export type Valor = string | number | boolean;
export type Mira = 'izquierda' | 'derecha';
export type Idioma = 'es' | 'en';

export interface Punto {
  x: number;
  y: number;
}

/**
 * Una condición (§8.4). Puede ser:
 * - un texto: "tengo tortillas", "no tengo limones", "objetivosCompletos", "globo"
 * - un arreglo: todas deben cumplirse (Y lógico)
 * - { alguno: [...] }: basta con que se cumpla una (O lógico)
 */
export type Condicion = string | Condicion[] | { alguno: Condicion[] };

// ─── Pasos del diálogo, ya convertidos (§8.3) ────────────────────────────────

/** Una línea de diálogo: muestra un globo y espera un toque o el fin del audio. */
export interface Linea {
  tipo: 'linea';
  /** id del personaje que habla (clave de meta.personajes). */
  hablante: string;
  texto: string;
  /** Traducción al idioma base, si el hablante usa otro idioma. */
  trad?: string;
  /** Palabra de vocabulario en inglés (junto con `es`, forma una tarjeta del álbum). */
  en?: string;
  es?: string;
  /** Clave de la voz grabada. Si no existe, se usa voz sintetizada. */
  audio?: string;
}

/** Pasos escritos en el lugar, o el nombre de una secuencia declarada en "secuencias". */
export type PasosOSecuencia = Paso[] | string;

export interface Opcion {
  texto?: string;
  trad?: string;
  imagen?: string;
  audio?: string;
  /** Si tiene condición, la opción solo aparece cuando se cumple. */
  condicion?: Condicion;
  pasos: PasosOSecuencia;
}

export interface PasoElige {
  tipo: 'elige';
  pregunta: string;
  opciones: Opcion[];
}

export interface PasoEfecto {
  tipo: 'efecto';
  nombre: string;
}

export interface PasoPon {
  tipo: 'pon';
  valores: Record<string, Valor>;
}

export interface PasoJuego {
  tipo: 'juego';
  /** Clave de la fábrica de minijuego registrada por el host. */
  clave: string;
  config?: unknown;
}

/**
 * A dónde camina alguien:
 * - un número: solo la x, conserva la y (formato v1)
 * - un texto: el nombre de un punto del mapa de Tiled
 * - { x, y }: un punto exacto
 */
export type DestinoCamina = number | string | Punto;

export interface PasoCamina {
  tipo: 'camina';
  destino: DestinoCamina;
  /** Quién camina. Si se omite, camina el jugador. */
  quien?: string;
}

export interface PasoSecuencia {
  tipo: 'secuencia';
  nombre: string;
}

export interface PasoCondicional {
  tipo: 'condicional';
  condicion: Condicion;
  pasos: Paso[];
}

/**
 * Mueve la cámara con suavidad hasta un personaje (su id) o un lugar (punto del mapa o { x, y }).
 * La cámara se queda ahí hasta que termina el diálogo; luego vuelve sola al jugador.
 */
export interface PasoEnfoca {
  tipo: 'enfoca';
  objetivo: string | Punto;
  /** 1 = sin acercamiento; 1.3 = un poco más cerca. */
  zoom: number;
}

/** Una pausa, para dar ritmo a una escena. */
export interface PasoEspera {
  tipo: 'espera';
  segundos: number;
}

/** Una tarjeta de título a pantalla completa que se dice en voz alta (para la intro). */
export interface PasoTitulo {
  tipo: 'titulo';
  texto: string;
  /** Clave de la voz grabada. Si no existe, se usa voz sintetizada. */
  audio?: string;
}

/** Un gesto de un personaje: "saltar", "saludar", "asentir", "sorpresa" o una animación propia de su atlas. */
export interface PasoGesto {
  tipo: 'gesto';
  nombre: string;
  /** Quién hace el gesto. Si se omite, el jugador. */
  quien?: string;
}

export type Paso =
  | Linea
  | PasoElige
  | PasoEfecto
  | PasoPon
  | PasoJuego
  | PasoCamina
  | PasoSecuencia
  | PasoCondicional
  | PasoEnfoca
  | PasoEspera
  | PasoTitulo
  | PasoGesto;

/** Una rama del diálogo de un NPC: se ejecuta la primera cuya condición se cumple. */
export interface Rama {
  condicion?: Condicion;
  pasos: Paso[];
}

/** Qué hacer al volver de un minijuego (§8.5). */
export interface AlVolver {
  /** Ítems que el minijuego debía otorgar. */
  conItem: string[];
  siLogrado: PasosOSecuencia;
  siNo: PasosOSecuencia;
}

/** Algo con lo que se puede hablar: un NPC o un prop interactivo. */
export interface Interlocutor {
  dialogo: Rama[];
  alVolver?: AlVolver;
}

// ─── Esquemas de Zod ─────────────────────────────────────────────────────────

const esquemaValor = z.union([z.string(), z.number(), z.boolean()]);
const esquemaPunto = z.object({ x: z.number(), y: z.number() });

export const esquemaCondicion: z.ZodType<Condicion> = z.lazy(() =>
  z.union([
    z.string().min(1),
    z.array(esquemaCondicion),
    z.strictObject({ alguno: z.array(esquemaCondicion).min(1) }),
  ]),
);

// Los pasos se contienen unos a otros (un condicional tiene pasos dentro),
// por eso se declaran con z.lazy: el esquema se resuelve cuando se usa.
const listaDePasos: z.ZodType<Paso[]> = z.lazy(() => z.array(esquemaPaso));
const pasosOSecuencia: z.ZodType<PasosOSecuencia> = z.lazy(() => z.union([z.string(), z.array(esquemaPaso)]));

const esquemaLinea = z
  .object({
    dice: z.string(),
    texto: z.string(),
    trad: z.string().optional(),
    en: z.string().optional(),
    es: z.string().optional(),
    audio: z.string().optional(),
  })
  .transform((json): Linea => ({
    tipo: 'linea',
    hablante: json.dice,
    texto: json.texto,
    trad: json.trad,
    en: json.en,
    es: json.es,
    audio: json.audio,
  }));

const esquemaElige = z
  .object({
    elige: z.string(),
    opciones: z
      .array(
        z.object({
          texto: z.string().optional(),
          trad: z.string().optional(),
          imagen: z.string().optional(),
          audio: z.string().optional(),
          cuando: esquemaCondicion.optional(),
          secuencia: pasosOSecuencia,
        }),
      )
      .min(1),
  })
  .transform((json): PasoElige => ({
    tipo: 'elige',
    pregunta: json.elige,
    opciones: json.opciones.map((opcion) => ({
      texto: opcion.texto,
      trad: opcion.trad,
      imagen: opcion.imagen,
      audio: opcion.audio,
      condicion: opcion.cuando,
      pasos: opcion.secuencia,
    })),
  }));

const esquemaEfecto = z
  .object({ efecto: z.string() })
  .transform((json): PasoEfecto => ({ tipo: 'efecto', nombre: json.efecto }));

const esquemaPon = z
  .object({ pon: z.record(z.string(), esquemaValor) })
  .transform((json): PasoPon => ({ tipo: 'pon', valores: json.pon }));

const esquemaJuego = z
  .object({ juego: z.string(), config: z.unknown().optional() })
  .transform((json): PasoJuego => ({ tipo: 'juego', clave: json.juego, config: json.config }));

const esquemaCamina = z
  .object({ camina: z.union([z.number(), z.string(), esquemaPunto]), quien: z.string().optional() })
  .transform((json): PasoCamina => ({ tipo: 'camina', destino: json.camina, quien: json.quien }));

const esquemaSecuencia = z
  .object({ secuencia: z.string() })
  .transform((json): PasoSecuencia => ({ tipo: 'secuencia', nombre: json.secuencia }));

const esquemaCondicional = z
  .object({ cuando: esquemaCondicion, dice: listaDePasos })
  .transform((json): PasoCondicional => ({ tipo: 'condicional', condicion: json.cuando, pasos: json.dice }));

const esquemaEnfoca = z
  .object({ enfoca: z.union([z.string(), esquemaPunto]), zoom: z.number().positive().default(1) })
  .transform((json): PasoEnfoca => ({ tipo: 'enfoca', objetivo: json.enfoca, zoom: json.zoom }));

const esquemaEspera = z
  .object({ espera: z.number().positive() })
  .transform((json): PasoEspera => ({ tipo: 'espera', segundos: json.espera }));

const esquemaTitulo = z
  .object({ titulo: z.string().min(1), audio: z.string().optional() })
  .transform((json): PasoTitulo => ({ tipo: 'titulo', texto: json.titulo, audio: json.audio }));

const esquemaGesto = z
  .object({ gesto: z.string().min(1), quien: z.string().optional() })
  .transform((json): PasoGesto => ({ tipo: 'gesto', nombre: json.gesto, quien: json.quien }));

/**
 * Cada paso se reconoce por su clave distintiva. El orden importa:
 * "cuando" va antes que "dice" porque un condicional también trae "dice" (su cuerpo).
 */
const ESQUEMAS_DE_PASO: { clave: string; esquema: z.ZodType<Paso> }[] = [
  { clave: 'cuando', esquema: esquemaCondicional },
  { clave: 'elige', esquema: esquemaElige },
  { clave: 'juego', esquema: esquemaJuego },
  { clave: 'camina', esquema: esquemaCamina },
  { clave: 'secuencia', esquema: esquemaSecuencia },
  { clave: 'efecto', esquema: esquemaEfecto },
  { clave: 'pon', esquema: esquemaPon },
  { clave: 'enfoca', esquema: esquemaEnfoca },
  { clave: 'espera', esquema: esquemaEspera },
  { clave: 'titulo', esquema: esquemaTitulo },
  { clave: 'gesto', esquema: esquemaGesto },
  { clave: 'dice', esquema: esquemaLinea },
];

const esquemaPaso: z.ZodType<Paso> = z.unknown().transform((json, contexto): Paso => {
  const esObjeto = typeof json === 'object' && json !== null && !Array.isArray(json);
  const encontrado = esObjeto ? ESQUEMAS_DE_PASO.find(({ clave }) => clave in json) : undefined;

  if (!encontrado) {
    const claves = ESQUEMAS_DE_PASO.map(({ clave }) => clave).join(', ');
    contexto.addIssue({ code: 'custom', message: `paso sin intención: se espera una clave entre ${claves}` });
    return z.NEVER;
  }

  const resultado = encontrado.esquema.safeParse(json);
  if (!resultado.success) {
    for (const problema of resultado.error.issues) {
      contexto.addIssue({ code: 'custom', message: problema.message, path: problema.path });
    }
    return z.NEVER;
  }
  return resultado.data;
});

const esquemaRama = z
  .object({ cuando: esquemaCondicion.optional(), dice: z.array(esquemaPaso) })
  .transform((json): Rama => ({ condicion: json.cuando, pasos: json.dice }));

const esquemaAlVolver = z
  .object({
    conItem: z.union([z.string(), z.array(z.string()).min(1)]),
    siLogrado: pasosOSecuencia,
    siNo: pasosOSecuencia,
  })
  .transform((json): AlVolver => ({
    conItem: typeof json.conItem === 'string' ? [json.conItem] : json.conItem,
    siLogrado: json.siLogrado,
    siNo: json.siNo,
  }));

/**
 * Claves de atlas por animación. "idle", "caminar" y "hablar" las usa el motor solo;
 * cualquier otro nombre (por ejemplo "bailar") es un gesto que se pide con { "gesto": "bailar" }.
 */
const esquemaAnimaciones = z
  .object({
    idle: z.string().optional(),
    caminar: z.string().optional(),
    hablar: z.string().optional(),
  })
  .catchall(z.string());

/** Un elemento de "layout" del formato v1 (solo se usa sin mapa de Tiled). */
const esquemaElementoLayout = z.looseObject({ tipo: z.string() });

const esquemaInterlocutor = z.object({
  dialogo: z.array(esquemaRama),
  alVolver: esquemaAlVolver.optional(),
  // Formato v1, solo sin mapa de Tiled:
  x: z.number().optional(),
  y: z.number().optional(),
  radio: z.number().optional(),
  forma: z.object({ tipo: z.literal('rect'), w: z.number(), h: z.number() }).optional(),
  props: z.array(esquemaElementoLayout).optional(),
});

const esquemaPersonaje = z.object({
  idioma: z.enum(['es', 'en']),
  sprite: z.string(),
  /** Milisegundos por letra al escribir su texto (un personaje lento escribe despacio). */
  velocidad: z.number().positive().optional(),
  animaciones: esquemaAnimaciones.optional(),
});

const esquemaJugador = z.object({
  personaje: z.string(),
  animaciones: esquemaAnimaciones.optional(),
  /** Píxeles lógicos por segundo. */
  velocidadX: z.number().positive().default(240),
  velocidadY: z.number().positive().default(110),
  /** Distancia a la que se avisa de algo interactivo. */
  radioAviso: z.number().positive().default(160),
});

/** Un personaje que sigue al jugador a todas partes. */
const esquemaAcompanante = z.object({
  personaje: z.string(),
  /** Píxeles que intenta mantener entre él y el jugador. */
  distancia: z.number().positive().default(110),
});

const esquemaCamara = z.object({
  modo: z.enum(['follow', 'rails', 'pan']).default('follow'),
  zonaMuerta: z.number().nonnegative().default(280),
  suavizado: z.number().min(0).max(1).default(0.1),
  seguirY: z.number().min(0).max(1).default(0.04),
  inercia: z.number().min(0).max(1).default(0.92),
  rebote: z.number().min(0).default(0.05),
  // Formato v1, solo sin mapa de Tiled:
  enfoques: z.array(z.object({ x: z.number(), y: z.number().optional(), zoom: z.number().optional() })).optional(),
});

const esquemaMundo = z.object({
  /** Tamaño de diseño. El motor escala a la pantalla real manteniendo la proporción. */
  logico: z.tuple([z.number().positive(), z.number().positive()]).default([1280, 720]),
  fondo: z.string().optional(),
  camara: esquemaCamara.prefault({}),
  sonidos: z
    .object({ tap: z.string().optional(), cerca: z.string().optional(), musica: z.string().optional() })
    .optional(),
  // Formato v1, solo sin mapa de Tiled:
  ancho: z.number().positive().optional(),
  alto: z.number().positive().optional(),
  piso: z.tuple([z.number(), z.number()]).optional(),
  inicio: z.number().optional(),
  capas: z
    .array(z.object({ asset: z.string(), parallax: z.number().default(1), depth: z.number().default(0) }))
    .optional(),
});

const esquemaEstado = z.object({
  objetivos: z.array(z.string()).default([]),
  /** Variables libres. "charlas.*" declara todas las que empiezan con "charlas.". */
  variables: z.array(z.string()).default([]),
  /** Cómo nombrar cada objetivo en {faltan}: { "tortillas": "las tortillas" }. */
  lista: z.record(z.string(), z.string()).optional(),
  dinero: z.number().optional(),
});

const esquemaSalida = z.object({
  destino: z.string(),
  requiere: esquemaCondicion.optional(),
  siBloqueada: pasosOSecuencia.optional(),
  flecha: z.object({ visibleCuando: esquemaCondicion.optional(), texto: z.string().optional() }).optional(),
  // Formato v1, solo sin mapa de Tiled:
  x: z.number().optional(),
});

export const esquemaContenido = z.object({
  meta: z.object({
    id: z.string().min(1),
    titulo: z.string(),
    personajes: z.record(z.string(), esquemaPersonaje),
  }),
  jugador: esquemaJugador.optional(),
  acompanante: esquemaAcompanante.optional(),
  mundo: esquemaMundo.prefault({}),
  estado: esquemaEstado.prefault({}),
  secuencias: z.record(z.string(), z.array(esquemaPaso)).default({}),
  npcs: z.record(z.string(), esquemaInterlocutor).default({}),
  interactivos: z.record(z.string(), esquemaInterlocutor).default({}),
  comentarios: z.record(z.string(), z.array(esquemaLinea)).default({}),
  salida: esquemaSalida.optional(),
  /** Escena animada al empezar un nivel sin partida guardada. Se puede saltar. */
  intro: pasosOSecuencia.optional(),
  // Formato v1, solo sin mapa de Tiled:
  layout: z.array(esquemaElementoLayout).optional(),
});

/** El contenido de un nivel, ya validado y con los pasos convertidos. */
export type Contenido = z.output<typeof esquemaContenido>;
export type Personaje = z.output<typeof esquemaPersonaje>;
export type Acompanante = z.output<typeof esquemaAcompanante>;
export type ElementoLayout = z.output<typeof esquemaElementoLayout>;
export type DeclaracionDeEstado = Contenido['estado'];

/** Convierte la ruta de un error de Zod en texto legible: ["npcs", "tortu", "dialogo", 0] → "npcs.tortu.dialogo[0]". */
export function rutaLegible(ruta: PropertyKey[]): string {
  let texto = '';
  for (const parte of ruta) {
    if (typeof parte === 'number') texto += `[${parte}]`;
    else if (texto === '') texto = String(parte);
    else texto += `.${String(parte)}`;
  }
  return texto;
}
