/**
 * WorldBuilder: convierte el modelo del mundo en objetos de Phaser.
 *
 *   - Capas de fondo y de frente, con parallax.
 *   - Props del decorado (imagen o, para un puesto sin imagen, figuras dibujadas).
 *   - Huellas: la franja de abajo de cada prop no pisable, que bloquea el paso.
 *   - Actores: el jugador, su acompañante y los NPCs.
 *   - La lista de cosas que se pueden tocar (interactuables).
 */
import * as Phaser from 'phaser';
import type { Contenido } from '../../core/esquema';
import { ajustarAlPiso, type Forma } from '../../core/geometria';
import type { Entidad, Prop } from '../../core/mundo';
import type { SaveBlob } from '../../core/partida';
import type { Nivel } from '../../core/validar';
import { Actor } from './actor';
import { PROFUNDIDAD, prefiereMenosMovimiento } from './interfaz';

/** Algo que se puede tocar: un NPC, un prop con id o la salida. */
export interface Interactuable {
  tipo: 'npcs' | 'interactivos' | 'salida';
  id: string;
  entidad: Pick<Entidad, 'puntoDePie' | 'hotspot' | 'puntoInteraccion'>;
  /** La imagen que late cuando el jugador se acerca. */
  visual?: Phaser.GameObjects.Sprite | Phaser.GameObjects.Image;
  /** Si es un personaje, su actor (para latir sin pelear con su animación). */
  actor?: Actor;
}

export interface ElementosDelMundo {
  jugador?: Actor;
  /** El personaje que sigue al jugador, si el nivel tiene "acompanante". */
  acompanante?: Actor;
  npcs: Map<string, Actor>;
  interactuables: Interactuable[];
  /** Zonas del piso que no se pueden pisar. */
  huellas: Forma[];
}

/** Proporción del alto de un prop que ocupa su huella, si no se indica otra. */
const PROPORCION_DE_HUELLA_POR_DEFECTO = 0.2;

const VELOCIDAD_DE_NPC = { x: 200, y: 90 };

/** El acompañante camina un poco más rápido que el jugador para poder alcanzarlo. */
const VENTAJA_DE_VELOCIDAD_DEL_ACOMPANANTE = 1.15;

/** Animaciones que se repiten sin fin; las demás son gestos y se reproducen una vez. */
const ANIMACIONES_CONTINUAS = new Set(['idle', 'caminar', 'hablar']);

/** Colores de lona con nombre. También se acepta un color hexadecimal ("#3fa34d"). */
const COLORES_DE_LONA: Record<string, number> = {
  verde: 0x3fa34d,
  rojo: 0xd8433b,
  azul: 0x2f6fd0,
  amarillo: 0xf2c230,
  rosa: 0xef7fb0,
  naranja: 0xf08a24,
  morado: 0x8a4fc4,
  blanco: 0xf4f1ea,
};

export function construirMundo(escena: Phaser.Scene, nivel: Nivel, partida: SaveBlob | undefined): ElementosDelMundo {
  const elementos: ElementosDelMundo = { npcs: new Map(), interactuables: [], huellas: [] };

  crearAnimaciones(escena, nivel.contenido);
  dibujarCapas(escena, nivel);
  for (const prop of nivel.mundo.props) dibujarProp(escena, prop, elementos);
  crearNpcs(escena, nivel, elementos);
  elementos.jugador = crearJugador(escena, nivel, partida);
  if (elementos.jugador) elementos.acompanante = crearAcompanante(escena, nivel, elementos.jugador);

  const salida = nivel.mundo.salida;
  if (salida && nivel.contenido.salida) {
    elementos.interactuables.push({ tipo: 'salida', id: 'salida', entidad: salida });
  }
  return elementos;
}

/**
 * Cada clave de animación es un atlas; la animación usa todos sus cuadros en orden.
 * "idle", "caminar" y "hablar" se repiten sin fin; un gesto propio ("bailar") se reproduce una vez.
 */
function crearAnimaciones(escena: Phaser.Scene, contenido: Contenido): void {
  const repeticionesPorClave = new Map<string, number>();
  const agregar = (animaciones: Record<string, string | undefined> | undefined) => {
    for (const [nombre, clave] of Object.entries(animaciones ?? {})) {
      if (!clave) continue;
      const repeticiones = ANIMACIONES_CONTINUAS.has(nombre) ? -1 : 0; // -1 = sin fin
      repeticionesPorClave.set(clave, repeticiones);
    }
  };
  agregar(contenido.jugador?.animaciones);
  for (const personaje of Object.values(contenido.meta.personajes)) agregar(personaje.animaciones);

  for (const [clave, repeticiones] of repeticionesPorClave) {
    if (!escena.textures.exists(clave) || escena.anims.exists(clave)) continue;
    escena.anims.create({ key: clave, frames: escena.anims.generateFrameNames(clave), frameRate: 10, repeat: repeticiones });
  }
}

function dibujarCapas(escena: Phaser.Scene, nivel: Nivel): void {
  const menosMovimiento = prefiereMenosMovimiento();
  nivel.mundo.capas.forEach((capa, orden) => {
    let parallax = capa.parallax;
    // Con movimiento reducido el parallax se acerca a 1: las capas se mueven casi juntas.
    if (menosMovimiento) parallax = 1 + (parallax - 1) * 0.3;

    const profundidad = (capa.alFrente ? PROFUNDIDAD.capasAlFrente : PROFUNDIDAD.capasDeFondo) + orden;
    escena.add.image(capa.x, capa.y, capa.asset).setOrigin(0).setScrollFactor(parallax, 1).setDepth(profundidad);
  });
}

function dibujarProp(escena: Phaser.Scene, prop: Prop, elementos: ElementosDelMundo): void {
  const profundidad = prop.encima
    ? PROFUNDIDAD.decoradoEncima + prop.puntoDePie.y
    : prop.puntoDePie.y + prop.ajusteDeProfundidad;

  let ancho = prop.ancho;
  let alto = prop.alto;
  let imagen: Phaser.GameObjects.Image | undefined;

  if (prop.asset) {
    imagen = escena.add.image(prop.puntoDePie.x, prop.puntoDePie.y, prop.asset);
    imagen.setOrigin(0.5, 1).setFlipX(prop.volteadoHorizontal).setDepth(profundidad);
    if (ancho > 0 && alto > 0) {
      imagen.setDisplaySize(ancho, alto);
    } else {
      ancho = imagen.width;
      alto = imagen.height;
    }
  } else {
    ancho = ancho || 360;
    alto = alto || 200;
    dibujarPuesto(escena, prop, ancho, alto, profundidad);
  }

  const izquierda = prop.puntoDePie.x - ancho / 2;

  if (!prop.pisable) {
    const altoDeHuella = prop.altoDeHuella ?? alto * PROPORCION_DE_HUELLA_POR_DEFECTO;
    elementos.huellas.push({ tipo: 'rect', x: izquierda, y: prop.puntoDePie.y - altoDeHuella, ancho, alto: altoDeHuella });
  }

  if (prop.id) {
    elementos.interactuables.push({
      tipo: 'interactivos',
      id: prop.id,
      entidad: {
        puntoDePie: prop.puntoDePie,
        hotspot: { tipo: 'rect', x: izquierda, y: prop.puntoDePie.y - alto, ancho, alto },
      },
      visual: imagen,
    });
  }
}

/** Un puesto sin imagen: dos postes, mostrador, lona de color y letrero. */
function dibujarPuesto(escena: Phaser.Scene, prop: Prop, ancho: number, alto: number, profundidad: number): void {
  const x = prop.puntoDePie.x - ancho / 2;
  const y = prop.puntoDePie.y - alto;
  const altoDeLona = alto * 0.3;
  const colorDeLona = prop.lona?.startsWith('#')
    ? Phaser.Display.Color.HexStringToColor(prop.lona).color
    : (COLORES_DE_LONA[prop.lona ?? ''] ?? COLORES_DE_LONA.rojo!);

  const dibujo = escena.add.graphics().setDepth(profundidad);
  // Postes
  dibujo.fillStyle(0x8b5a2b);
  dibujo.fillRect(x + 8, y + altoDeLona, 10, alto - altoDeLona);
  dibujo.fillRect(x + ancho - 18, y + altoDeLona, 10, alto - altoDeLona);
  // Mostrador
  dibujo.fillStyle(0xc68642);
  dibujo.fillRect(x, y + alto * 0.65, ancho, alto * 0.35);
  // Lona, con un brillo en el borde
  dibujo.fillStyle(colorDeLona);
  dibujo.fillRect(x - 10, y, ancho + 20, altoDeLona);
  dibujo.fillStyle(0xffffff, 0.35);
  dibujo.fillRect(x - 10, y + altoDeLona - 8, ancho + 20, 8);

  if (prop.letrero) {
    escena.add
      .text(prop.puntoDePie.x, y + altoDeLona / 2, prop.letrero, { fontFamily: 'sans-serif', fontSize: 24, fontStyle: 'bold', color: '#ffffff' })
      .setOrigin(0.5)
      .setDepth(profundidad + 0.1);
  }
}

/** Un NPC tiene sprite si existe un personaje con su mismo id en meta.personajes. */
function crearNpcs(escena: Phaser.Scene, nivel: Nivel, elementos: ElementosDelMundo): void {
  const movimientoReducido = prefiereMenosMovimiento();
  for (const [id, entidad] of Object.entries(nivel.mundo.npcs)) {
    const personaje = nivel.contenido.meta.personajes[id];
    let actor: Actor | undefined;

    if (personaje) {
      actor = new Actor(escena, entidad.puntoDePie, personaje.sprite, {
        animaciones: personaje.animaciones,
        velocidad: VELOCIDAD_DE_NPC,
        movimientoReducido,
      });
      actor.mirarHacia(entidad.mira);
      elementos.npcs.set(id, actor);
    }
    elementos.interactuables.push({ tipo: 'npcs', id, entidad, visual: actor?.sprite, actor });
  }
}

/** El jugador aparece en inicioJugador, o donde quedó en la partida guardada (ajustado al piso). */
function crearJugador(escena: Phaser.Scene, nivel: Nivel, partida: SaveBlob | undefined): Actor | undefined {
  const jugador = nivel.contenido.jugador;
  if (!jugador) return undefined;

  const inicio = nivel.mundo.iniciosDelJugador[0]!;
  const guardado = partida?.momento?.jugador;
  const posicion = guardado ? ajustarAlPiso(guardado, nivel.mundo.pisos) : inicio;
  const personaje = nivel.contenido.meta.personajes[jugador.personaje]!;

  const actor = new Actor(escena, posicion, personaje.sprite, {
    animaciones: jugador.animaciones,
    velocidad: { x: jugador.velocidadX, y: jugador.velocidadY },
    movimientoReducido: prefiereMenosMovimiento(),
  });
  actor.mirarHacia(guardado?.mira ?? inicio.mira);
  return actor;
}

/** El acompañante aparece detrás del jugador (del lado contrario al que mira), ajustado al piso. */
function crearAcompanante(escena: Phaser.Scene, nivel: Nivel, jugador: Actor): Actor | undefined {
  const acompanante = nivel.contenido.acompanante;
  if (!acompanante) return undefined;

  const personaje = nivel.contenido.meta.personajes[acompanante.personaje]!; // la validación garantiza que existe
  const datosDelJugador = nivel.contenido.jugador!; // sin jugador no se crea acompañante
  const ladoDeAtras = jugador.mira === 'derecha' ? -1 : 1;
  const posicion = ajustarAlPiso(
    { x: jugador.posicion.x + ladoDeAtras * acompanante.distancia, y: jugador.posicion.y },
    nivel.mundo.pisos,
  );

  const actor = new Actor(escena, posicion, personaje.sprite, {
    animaciones: personaje.animaciones,
    velocidad: {
      x: datosDelJugador.velocidadX * VENTAJA_DE_VELOCIDAD_DEL_ACOMPANANTE,
      y: datosDelJugador.velocidadY * VENTAJA_DE_VELOCIDAD_DEL_ACOMPANANTE,
    },
    movimientoReducido: prefiereMenosMovimiento(),
  });
  actor.mirarHacia(jugador.mira);
  return actor;
}
