/**
 * WorldBuilder: convierte el modelo del mundo en objetos de Phaser.
 *
 *   - Capas de fondo y de frente, con parallax.
 *   - Props del decorado (imagen o, para un puesto sin imagen, figuras dibujadas).
 *   - Huellas: la franja de abajo de cada prop no pisable, que bloquea el paso.
 *   - Actores: el jugador y los NPCs.
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
}

export interface ElementosDelMundo {
  jugador?: Actor;
  npcs: Map<string, Actor>;
  interactuables: Interactuable[];
  /** Zonas del piso que no se pueden pisar. */
  huellas: Forma[];
}

/** Proporción del alto de un prop que ocupa su huella, si no se indica otra. */
const PROPORCION_DE_HUELLA_POR_DEFECTO = 0.2;

const VELOCIDAD_DE_NPC = { x: 200, y: 90 };

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

  const salida = nivel.mundo.salida;
  if (salida && nivel.contenido.salida) {
    elementos.interactuables.push({ tipo: 'salida', id: 'salida', entidad: salida });
  }
  return elementos;
}

/** Cada clave de animación es un atlas; la animación usa todos sus cuadros en orden. */
function crearAnimaciones(escena: Phaser.Scene, contenido: Contenido): void {
  const claves = new Set<string>();
  for (const clave of Object.values(contenido.jugador?.animaciones ?? {})) if (clave) claves.add(clave);
  for (const personaje of Object.values(contenido.meta.personajes)) {
    for (const clave of Object.values(personaje.animaciones ?? {})) if (clave) claves.add(clave);
  }

  for (const clave of claves) {
    if (!escena.textures.exists(clave) || escena.anims.exists(clave)) continue;
    escena.anims.create({ key: clave, frames: escena.anims.generateFrameNames(clave), frameRate: 10, repeat: -1 });
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
  const rebotar = !prefiereMenosMovimiento();
  for (const [id, entidad] of Object.entries(nivel.mundo.npcs)) {
    const personaje = nivel.contenido.meta.personajes[id];
    let visual: Phaser.GameObjects.Sprite | undefined;

    if (personaje) {
      const actor = new Actor(escena, entidad.puntoDePie, personaje.sprite, {
        animaciones: personaje.animaciones,
        velocidad: VELOCIDAD_DE_NPC,
        rebotarAlCaminar: rebotar,
      });
      actor.mirarHacia(entidad.mira);
      elementos.npcs.set(id, actor);
      visual = actor.sprite;
    }
    elementos.interactuables.push({ tipo: 'npcs', id, entidad, visual });
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
    rebotarAlCaminar: !prefiereMenosMovimiento(),
  });
  actor.mirarHacia(guardado?.mira ?? inicio.mira);
  return actor;
}
