// Escena de Phaser: WorldBuilder, PlayerController, CameraRig y el Escenario que usa el DialogueRuntime.
import * as Phaser from 'phaser';
import { DialogueRuntime, type Escenario, type MiniGameResult } from '../../core/dialogo';
import type { Linea, Mira, Opcion, Vec } from '../../core/esquema';
import type { GameState, SaveBlob } from '../../core/estado';
import { ajustarAlPiso, cajaForma, dentroForma, dentroPoligono, type Forma } from '../../core/geometria';
import type { Entidad } from '../../core/mapa';
import { EscenarioError, type EFECTOS, type Nivel } from '../../core/validar';
import { Actor } from './actor';
import { GestorAssets, listaAssets } from './assets';
import { barraDeCarga, Globo, mostrarOpciones, tono, Voz, type Escala, type Idioma } from './ui';

export interface MiniGameContext {
  scene: Phaser.Scene;
  assets: import('./assets').AssetManager;
  state: { get(k: string): unknown; cumple: GameState['cumple']; readonly valores: Readonly<GameState['valores']> };
  audio: { tocar(clave: string): void; decir(texto: string, idioma: Idioma, audio?: string): Promise<void> };
}
export type MiniGameFactory = (ctx: MiniGameContext, config?: unknown) => Promise<MiniGameResult>;

export interface Deps {
  nivel: Nivel;
  estado: GameState;
  save?: SaveBlob;
  assetsRoot: string;
  cdn: string[];
  minigames: Record<string, MiniGameFactory>;
  base: Idioma;
  escala: Escala;
  rng: () => number;
  debug: boolean;
  emitir: (evento: string, ...args: unknown[]) => void;
  alSalir: (destino: string) => void;
}

interface Interactuable {
  tipo: 'npcs' | 'interactivos' | 'salida';
  id: string;
  ent: Pick<Entidad, 'pie' | 'hotspot' | 'puntoInteraccion'>;
  visual?: Phaser.GameObjects.Sprite | Phaser.GameObjects.Image;
}

const LONAS: Record<string, number> = {
  verde: 0x3fa34d, rojo: 0xd8433b, azul: 0x2f6fd0, amarillo: 0xf2c230, rosa: 0xef7fb0, naranja: 0xf08a24, morado: 0x8a4fc4, blanco: 0xf4f1ea,
};
const colorLona = (c?: string) => (c?.startsWith('#') ? Phaser.Display.Color.HexStringToColor(c).color : LONAS[c ?? ''] ?? 0xd8433b);

const UMBRAL_TAP = 8;
const reducido = () => globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

const EFECTOS_IMPL: Record<(typeof EFECTOS)[number], (s: Phaser.Scene, en: Vec) => Phaser.GameObjects.Particles.ParticleEmitter> = {
  magia: (s, en) => {
    const e = s.add.particles(en.x, en.y, 'esc:chispa', {
      speed: { min: 80, max: 260 }, lifespan: 900, scale: { start: 1.4, end: 0 }, tint: [0xffe066, 0xff8ad8, 0x8ae2ff], emitting: false,
    }).setDepth(1.5e6);
    e.explode(40);
    [660, 880, 1320].forEach((f, i) => s.time.delayedCall(i * 110, () => tono(s, f)));
    return e;
  },
  confeti: (s) => {
    const v = s.cameras.main.worldView;
    const e = s.add.particles(0, v.y - 10, 'esc:chispa', {
      x: { min: v.x, max: v.right }, speedY: { min: 120, max: 300 }, speedX: { min: -60, max: 60 }, lifespan: 1600,
      scale: { start: 1.2, end: 0.6 }, tint: [0xe2572b, 0x3fa34d, 0x2f6fd0, 0xf2c230, 0xef7fb0], emitting: false,
    }).setDepth(1.5e6);
    e.explode(90);
    tono(s, 990, 0.3);
    return e;
  },
};

export class EscenaMundo extends Phaser.Scene implements Escenario {
  runtime!: DialogueRuntime;
  jugador?: Actor;
  private npcs = new Map<string, Actor>();
  private gestor!: GestorAssets;
  private voz!: Voz;
  private huellas: Forma[] = [];
  private interactuables: Interactuable[] = [];
  private cercano?: { it: Interactuable; icono: Phaser.GameObjects.Text; tween?: Phaser.Tweens.Tween; escala: [number, number] };
  private alAvanzar?: () => void;
  private alElegir?: (i: number) => void;
  private comentario?: () => void;
  private zonasDentro = new Set<number>();
  private ultimaZona = new Map<number, number>();
  private flecha?: Phaser.GameObjects.Text;
  private teclas?: Record<'arriba' | 'abajo' | 'izq' | 'der' | 'w' | 'a' | 's' | 'd', Phaser.Input.Keyboard.Key>;
  private presion?: { x: number; y: number; scrollX: number; scrollY: number; arrastre: boolean };
  private inercia = { x: 0, y: 0 };
  private intento = 0;
  private nMinijuego = 0;
  private inicio = 0;
  listo = false;

  constructor(private d: Deps) {
    super('escenario');
  }

  private get c() { return this.d.nivel.contenido; }
  private get m() { return this.d.nivel.mundo; }

  preload() {
    barraDeCarga(this);
    this.gestor = new GestorAssets(this, this.d.assetsRoot, this.d.cdn);
    this.gestor.encolar(listaAssets(this.c, this.m));
  }

  create() {
    const fatales = this.gestor.fatales();
    if (fatales.length) return this.d.emitir('error', new EscenarioError(fatales));
    for (const f of this.gestor.fallidos.filter((f) => f.tipo === 'audio')) console.warn(`[escenario-engine] audio ${f.clave} no cargado (${f.detalle}); se usará TTS`);

    this.voz = new Voz(this);
    this.inicio = this.time.now - (this.d.save?.momento?.tiempo ?? 0) * 1000;
    this.crearAnimaciones();
    this.make.graphics({}, false).fillStyle(0xffffff).fillCircle(5, 5, 5).generateTexture('esc:chispa', 10, 10).destroy();

    this.construirCapas();
    this.construirProps();
    this.construirActores();
    this.construirSalida();
    this.configurarCamara();
    this.configurarEntrada();
    if (this.d.debug) this.dibujarDebug();

    const musica = this.c.mundo.sonidos?.musica;
    if (musica && this.cache.audio.exists(musica)) this.sound.play(musica, { loop: true, volume: 0.4 });

    this.runtime = new DialogueRuntime(this.c, this.d.estado, this);
    this.d.estado.onCambio = () => this.actualizarFlecha();
    this.events.once('shutdown', () => { this.voz.callar(); this.runtime.abort(); });
    this.listo = true;
    this.d.emitir('listo');
  }

  // --- WorldBuilder ---

  private crearAnimaciones() {
    const claves = new Set([
      ...Object.values(this.c.jugador?.animaciones ?? {}),
      ...Object.values(this.c.meta.personajes).flatMap((p) => Object.values(p.animaciones ?? {})),
    ]);
    for (const k of claves) {
      if (k && this.textures.exists(k) && !this.anims.exists(k)) {
        this.anims.create({ key: k, frames: this.anims.generateFrameNames(k), frameRate: 10, repeat: -1 });
      }
    }
  }

  private construirCapas() {
    const quieto = reducido();
    this.m.capas.forEach((k, i) => {
      // Movimiento reducido: el parallax se acerca a 1 (menos desplazamiento relativo).
      const p = quieto ? 1 + (k.parallax - 1) * 0.3 : k.parallax;
      this.add.image(k.x, k.y, k.asset).setOrigin(0).setScrollFactor(p, 1).setDepth(k.frente ? 9e5 + i : -1e4 + i);
    });
  }

  private construirProps() {
    for (const p of this.m.props) {
      let w = p.ancho, h = p.alto;
      let visual: Phaser.GameObjects.Image | undefined;
      const depth = p.encima ? 5e5 + p.pie.y : p.pie.y + p.profundidad;
      if (p.asset) {
        visual = this.add.image(p.pie.x, p.pie.y, p.asset).setOrigin(0.5, 1).setFlipX(p.flipX).setDepth(depth);
        if (w && h) visual.setDisplaySize(w, h);
        else [w, h] = [visual.width, visual.height];
      } else {
        // Puesto sin imagen: lona de color, mostrador y letrero.
        w ||= 360; h ||= 200;
        const x = p.pie.x - w / 2, y = p.pie.y - h;
        this.add.graphics().setDepth(depth)
          .fillStyle(0x8b5a2b).fillRect(x + 8, y + h * 0.3, 10, h * 0.7).fillRect(x + w - 18, y + h * 0.3, 10, h * 0.7)
          .fillStyle(0xc68642).fillRect(x, y + h * 0.65, w, h * 0.35)
          .fillStyle(colorLona(p.lona)).fillRect(x - 10, y, w + 20, h * 0.3)
          .fillStyle(0xffffff, 0.35).fillRect(x - 10, y + h * 0.3 - 8, w + 20, 8);
        if (p.letrero) this.add.text(p.pie.x, y + h * 0.15, p.letrero, { fontFamily: 'sans-serif', fontSize: 24, fontStyle: 'bold', color: '#ffffff' }).setOrigin(0.5).setDepth(depth + 0.1);
      }
      if (!p.pisable) {
        const hh = p.huella ?? h * 0.2;
        this.huellas.push({ tipo: 'rect', x: p.pie.x - w / 2, y: p.pie.y - hh, w, h: hh });
      }
      if (p.id) this.interactuables.push({ tipo: 'interactivos', id: p.id, ent: { pie: p.pie, hotspot: { tipo: 'rect', x: p.pie.x - w / 2, y: p.pie.y - h, w, h } }, visual });
    }
  }

  private construirActores() {
    const bob = !reducido();
    for (const [id, ent] of Object.entries(this.m.npcs)) {
      const per = this.c.meta.personajes[id];
      let visual: Phaser.GameObjects.Sprite | undefined;
      if (per) {
        const a = new Actor(this, ent.pie, per.sprite, per.animaciones, 200, 90, bob);
        a.mirar(ent.mira);
        this.npcs.set(id, a);
        visual = a.sprite;
      }
      this.interactuables.push({ tipo: 'npcs', id, ent, visual });
    }
    const j = this.c.jugador;
    if (!j) return;
    const inicio = this.m.inicios[0]!;
    const guardado = this.d.save?.momento?.jugador;
    const pos = guardado ? ajustarAlPiso(guardado, this.m.pisos) : inicio;
    this.jugador = new Actor(this, pos, this.c.meta.personajes[j.personaje]!.sprite, j.animaciones, j.velocidadX, j.velocidadY, bob);
    this.jugador.mirar(guardado?.mira ?? inicio.mira);
  }

  private construirSalida() {
    const s = this.m.salida;
    if (!s || !this.c.salida) return;
    this.interactuables.push({ tipo: 'salida', id: 'salida', ent: s });
    if (!s.flecha) return;
    const caja = cajaForma(s.hotspot);
    const izq = caja.x + caja.w / 2 < this.m.ancho / 2;
    this.flecha = this.add.text(caja.x + caja.w / 2, caja.y, izq ? '⬅️' : '➡️', { fontSize: 64 }).setOrigin(0.5, 1).setDepth(8e5);
    if (this.c.salida.flecha?.texto) {
      this.flecha.setText(`${this.flecha.text}\n${this.c.salida.flecha.texto}`).setAlign('center').setFontFamily('sans-serif').setColor('#1d1d1b');
    }
    this.flecha.setScale(this.d.escala.ui);
    if (!reducido()) this.tweens.add({ targets: this.flecha, x: this.flecha.x + (izq ? -14 : 14), duration: 500, yoyo: true, repeat: -1 });
    this.actualizarFlecha();
  }

  private actualizarFlecha() {
    this.flecha?.setVisible(this.d.estado.cumple(this.c.salida?.flecha?.visibleCuando));
  }

  // --- CameraRig ---

  private configurarCamara() {
    const cam = this.cameras.main;
    cam.setBounds(0, 0, this.m.ancho, this.m.alto);
    const { modo, suavizado, seguirY, zonaMuerta } = this.c.mundo.camara;
    if (modo === 'follow' && this.jugador) {
      cam.startFollow(this.jugador.sprite, true, suavizado, seguirY);
      cam.setDeadzone(zonaMuerta, this.scale.height);
    }
    const x = this.d.save?.momento?.camara?.x;
    if (x !== undefined) cam.setScroll(x, cam.scrollY);
    else if (this.jugador) cam.centerOn(this.jugador.pos.x, this.scale.height / 2);
  }

  private moverCamara(dt: number) {
    const cam = this.cameras.main;
    const { modo, inercia } = this.c.mundo.camara;
    if (modo === 'rails' && this.m.enfoques.length) {
      const ref = this.jugador?.pos.x ?? this.m.enfoques[0]!.x;
      const e = this.m.enfoques.reduce((a, b) => (Math.abs(b.x - ref) < Math.abs(a.x - ref) ? b : a));
      const k = Math.min(1, dt * 4);
      cam.setZoom(cam.zoom + (e.zoom - cam.zoom) * k);
      cam.setScroll(cam.scrollX + (e.x - cam.width / 2 - cam.scrollX) * k, cam.scrollY + (e.y - cam.height / 2 - cam.scrollY) * k);
    } else if ((modo === 'pan' || !this.jugador) && !this.presion) {
      // ponytail: el rebote elástico en los bordes no está; los límites del mundo cortan en seco.
      cam.setScroll(cam.scrollX - this.inercia.x, cam.scrollY - this.inercia.y);
      this.inercia.x *= inercia;
      this.inercia.y *= inercia;
    }
  }

  // --- PlayerController ---

  private caminable = (p: Vec) => this.m.pisos.some((poly) => dentroPoligono(p, poly)) && !this.huellas.some((h) => dentroForma(p, h));

  private configurarEntrada() {
    const kb = this.input.keyboard;
    if (kb) {
      const K = Phaser.Input.Keyboard.KeyCodes;
      this.teclas = kb.addKeys({ arriba: K.UP, abajo: K.DOWN, izq: K.LEFT, der: K.RIGHT, w: K.W, a: K.A, s: K.S, d: K.D }) as never;
      kb.on('keydown', (ev: KeyboardEvent) => {
        if (ev.key === 'Enter' || ev.key === ' ') {
          if (this.runtime.activo) this.alAvanzar?.();
          else if (this.cercano) void this.interactuar(this.cercano.it);
        }
        const n = Number(ev.key);
        if (n >= 1 && n <= 9) this.alElegir?.(n - 1);
      });
    }
    const pan = this.c.mundo.camara.modo === 'pan' || !this.jugador;
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      const cam = this.cameras.main;
      this.presion = { x: p.x, y: p.y, scrollX: cam.scrollX, scrollY: cam.scrollY, arrastre: false };
      this.inercia = { x: 0, y: 0 };
    });
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      const pr = this.presion;
      if (!pr || !p.isDown) return;
      if (Math.hypot(p.x - pr.x, p.y - pr.y) > UMBRAL_TAP) pr.arrastre = true;
      if (pan && pr.arrastre) {
        const cam = this.cameras.main;
        const antes = cam.scrollX;
        cam.setScroll(pr.scrollX - (p.x - pr.x) / cam.zoom, pr.scrollY - (p.y - pr.y) / cam.zoom);
        this.inercia = { x: antes - cam.scrollX, y: 0 };
      }
    });
    this.input.on('pointerup', (p: Phaser.Input.Pointer) => {
      const tap = this.presion && !this.presion.arrastre;
      this.presion = undefined;
      if (tap) this.tap({ x: p.worldX, y: p.worldY });
    });
  }

  private tap(p: Vec) {
    this.voz.tocar(this.c.mundo.sonidos?.tap, 520);
    const it = this.interactuables
      .filter((i) => dentroForma(p, i.ent.hotspot))
      .sort((a, b) => b.ent.pie.y - a.ent.pie.y)[0];
    if (this.runtime.activo) {
      if (this.alAvanzar) this.alAvanzar();
      else if (it && !this.alElegir) this.ocupado(it);
      return;
    }
    if (it) return void this.interactuar(it);
    if (this.jugador) {
      this.intento++;
      void this.jugador.caminarA(ajustarAlPiso(p, this.m.pisos));
    }
  }

  private puntoDeAcercamiento(it: Interactuable): Vec {
    if (it.ent.puntoInteraccion) return ajustarAlPiso(it.ent.puntoInteraccion, this.m.pisos);
    const j = this.jugador!.pos;
    const caja = cajaForma(it.ent.hotspot);
    const lado = j.x < it.ent.pie.x ? -1 : 1;
    return ajustarAlPiso({ x: it.ent.pie.x + lado * (caja.w / 2 + 40), y: it.ent.pie.y + 10 }, this.m.pisos);
  }

  private async interactuar(it: Interactuable) {
    if (this.runtime.activo) return this.ocupado(it);
    const yo = ++this.intento;
    if (this.jugador) {
      await this.jugador.caminarA(this.puntoDeAcercamiento(it));
      if (yo !== this.intento || this.runtime.activo) return; // otro toque cambió el destino
      const hacia: Mira = it.ent.pie.x < this.jugador.pos.x ? 'izquierda' : 'derecha';
      this.jugador.mirar(hacia);
      this.npcs.get(it.id)?.mirar(hacia === 'izquierda' ? 'derecha' : 'izquierda');
    }
    this.quitarResaltado();
    if (it.tipo !== 'salida') return void this.runtime.hablar(it.tipo, it.id);
    const s = this.c.salida!;
    if (this.d.estado.cumple(s.requiere)) this.d.alSalir(s.destino);
    else if (s.siBloqueada) void this.runtime.ejecutar(s.siBloqueada);
  }

  private ocupado(it: Interactuable) {
    const caja = cajaForma(it.ent.hotspot);
    const t = this.add.text(it.ent.pie.x, caja.y, '…', { fontSize: 40 * this.d.escala.globos, color: '#1d1d1b', backgroundColor: '#ffffff', padding: { x: 12, y: 0 } })
      .setOrigin(0.5, 1).setDepth(1e6);
    this.time.delayedCall(800, () => t.destroy());
  }

  // --- Avisos sin lectura (§7.4) ---

  private proximidad() {
    const j = this.jugador;
    if (!j || this.runtime.activo) return this.quitarResaltado();
    const radio = this.c.jugador!.radioAviso;
    let mejor: Interactuable | undefined, d = radio;
    for (const it of this.interactuables) {
      const dd = Math.hypot(it.ent.pie.x - j.pos.x, it.ent.pie.y - j.pos.y);
      if (dd <= d) [mejor, d] = [it, dd];
    }
    if (mejor === this.cercano?.it) return;
    this.quitarResaltado();
    if (!mejor) return;
    const caja = cajaForma(mejor.ent.hotspot);
    const top = mejor.visual ? Math.min(caja.y, mejor.visual.y - mejor.visual.displayHeight) : caja.y;
    const icono = this.add.text(mejor.ent.pie.x, top - 6, mejor.tipo === 'npcs' ? '👂' : '👆', { fontSize: 48 })
      .setOrigin(0.5, 1).setDepth(1e6).setScale(this.d.escala.ui);
    const v = mejor.visual;
    const escala: [number, number] = [v?.scaleX ?? 1, v?.scaleY ?? 1];
    let tween: Phaser.Tweens.Tween | undefined;
    if (!reducido()) {
      this.tweens.add({ targets: icono, y: icono.y - 8, duration: 350, yoyo: true, repeat: -1 });
      if (v) tween = this.tweens.add({ targets: v, scaleX: escala[0] * 1.04, scaleY: escala[1] * 1.04, duration: 400, yoyo: true, repeat: -1 });
    }
    this.cercano = { it: mejor, icono, tween, escala };
    this.voz.tocar(this.c.mundo.sonidos?.cerca, 880);
  }

  private quitarResaltado() {
    const c = this.cercano;
    if (!c) return;
    c.icono.destroy();
    c.tween?.remove();
    c.it.visual?.setScale(c.escala[0], c.escala[1]);
    this.cercano = undefined;
  }

  // --- Comentarios del jugador (§8.6) ---

  private comentarios() {
    const j = this.jugador;
    if (!j || this.runtime.activo || this.comentario) return;
    this.m.zonas.forEach((z, i) => {
      const dentro = dentroForma(j.pos, z.forma);
      if (!dentro) return void this.zonasDentro.delete(i);
      if (this.zonasDentro.has(i)) return;
      this.zonasDentro.add(i);
      if (this.time.now - (this.ultimaZona.get(i) ?? -Infinity) < z.cooldown * 1000) return;
      this.ultimaZona.set(i, this.time.now);
      const lineas = this.c.comentarios[z.grupo] ?? [];
      const l = lineas[Math.floor(this.d.rng() * lineas.length)];
      if (l) this.decirComentario(l);
    });
  }

  private decirComentario(l: Linea) {
    const ctrl = new AbortController();
    const fin = () => { ctrl.abort(); globo.destroy(); this.comentario = undefined; };
    const globo = this.globoPara(l, this.d.estado.interpolar(l.texto));
    this.comentario = fin;
    void this.hablarLinea(l, this.d.estado.interpolar(l.texto), ctrl.signal).then(() => {
      if (!ctrl.signal.aborted) this.time.delayedCall(800, () => this.comentario === fin && fin());
    });
  }

  // --- Escenario (lo que pide el DialogueRuntime) ---

  private actorDe(hablante: string): Actor | undefined {
    if (hablante === this.c.jugador?.personaje) return this.jugador;
    return this.npcs.get(hablante) ?? (this.runtime?.enCurso ? this.npcs.get(this.runtime.enCurso) : undefined);
  }

  private globoPara(l: Linea, texto: string): Globo {
    const per = this.c.meta.personajes[l.dice];
    const actor = this.actorDe(l.dice);
    const v = this.cameras.main.worldView;
    const x = actor?.pos.x ?? v.centerX;
    const y = actor ? actor.sprite.y - actor.sprite.displayHeight - 12 : v.y + v.height * 0.4;
    const palabra = l.en && l.es ? `${l.en} · ${l.es}` : undefined;
    if (l.en && l.es) this.d.emitir('palabra', { en: l.en, es: l.es });
    return new Globo(this, x, y, texto, this.d.escala, {
      trad: per?.idioma !== this.d.base ? l.trad : undefined,
      palabra,
      velocidad: per?.velocidad,
    });
  }

  /** Voz original y, si el hablante usa otro idioma, la traducción en el idioma base. */
  private async hablarLinea(l: Linea, texto: string, signal: AbortSignal) {
    const idioma = this.c.meta.personajes[l.dice]?.idioma ?? this.d.base;
    await this.voz.decir(texto, idioma, l.audio, signal);
    if (l.trad && idioma !== this.d.base && !signal.aborted) await this.voz.decir(l.trad, this.d.base, undefined, signal);
  }

  linea(l: Linea, texto: string, signal: AbortSignal): Promise<void> {
    this.comentario?.();
    this.quitarResaltado();
    const actor = this.actorDe(l.dice);
    actor?.animar('hablar');
    const globo = this.globoPara(l, texto);
    return new Promise((res) => {
      let hecho = false;
      const fin = () => {
        if (hecho) return;
        hecho = true;
        this.alAvanzar = undefined;
        globo.destroy();
        this.voz.callar();
        actor?.animar('idle');
        res();
      };
      this.alAvanzar = () => (globo.escribiendo ? globo.completar() : fin());
      signal.addEventListener('abort', fin, { once: true });
      void this.hablarLinea(l, texto, signal).then(() => {
        if (hecho) return;
        globo.completar();
        this.time.delayedCall(700, fin);
      });
    });
  }

  elegir(pregunta: string, opciones: Opcion[], signal: AbortSignal): Promise<number> {
    return new Promise((res) => {
      const lectura = new AbortController();
      const fin = (i: number) => {
        if (i >= opciones.length) return;
        lectura.abort();
        this.voz.callar();
        ui.destroy();
        this.alElegir = undefined;
        res(i);
      };
      const ui = mostrarOpciones(this, pregunta, opciones, this.d.escala, fin);
      this.alElegir = fin;
      signal.addEventListener('abort', () => { lectura.abort(); ui.destroy(); this.alElegir = undefined; }, { once: true });
      // Nada requiere leer: se escucha la pregunta y cada opción mientras se resalta.
      void (async () => {
        await this.voz.decir(pregunta, this.d.base, undefined, lectura.signal);
        for (const [i, o] of opciones.entries()) {
          if (lectura.signal.aborted) return;
          ui.resaltar(i);
          if (o.audio || o.texto) await this.voz.decir(o.texto ?? '', this.d.base, o.audio, lectura.signal);
        }
        if (!lectura.signal.aborted) ui.resaltar(-1);
      })();
    });
  }

  async efecto(nombre: string): Promise<void> {
    const actor = this.jugador ?? [...this.npcs.values()][0];
    const en = actor ? { x: actor.pos.x, y: actor.sprite.y - actor.sprite.displayHeight / 2 } : { x: this.cameras.main.worldView.centerX, y: this.cameras.main.worldView.centerY };
    const e = EFECTOS_IMPL[nombre as keyof typeof EFECTOS_IMPL](this, en);
    await new Promise((res) => this.time.delayedCall(1000, res));
    e.destroy();
  }

  camina(quien: string | undefined, destino: number | string | Vec, signal: AbortSignal): Promise<void> {
    const actor = quien === undefined || quien === this.c.jugador?.personaje ? this.jugador : this.npcs.get(quien);
    if (!actor) return Promise.resolve();
    const objetivo = typeof destino === 'number' ? { x: destino, y: actor.pos.y } : typeof destino === 'string' ? this.m.puntos[destino]! : destino;
    signal.addEventListener('abort', () => actor.detener(), { once: true });
    return actor.caminarA(ajustarAlPiso(objetivo, this.m.pisos));
  }

  async juego(clave: string, config: unknown, signal: AbortSignal): Promise<MiniGameResult> {
    const fabrica = this.d.minigames[clave]!;
    const key = `minijuego:${clave}:${++this.nMinijuego}`;
    await new Promise<void>((res) => { this.cameras.main.fadeOut(300); this.cameras.main.once('camerafadeoutcomplete', () => res()); });
    this.scene.pause();
    // create puede correr de forma síncrona dentro de scene.add: se avisa desde la propia escena.
    let creada!: () => void;
    const lista = new Promise<void>((res) => (creada = res));
    const escena = new (class extends Phaser.Scene { create() { creada(); } })(key);
    this.scene.add(key, escena, true);
    await lista;
    escena.cameras.main.fadeIn(300);
    const assets = new GestorAssets(escena, this.d.assetsRoot, this.d.cdn);
    const estado = this.d.estado;
    const ctx: MiniGameContext = {
      scene: escena,
      assets,
      state: { get: (k) => estado.get(k), cumple: (c) => estado.cumple(c), get valores() { return { ...estado.valores }; } },
      audio: { tocar: (k) => escena.sound.play(k), decir: (t, i, a) => new Voz(escena).decir(t, i, a) },
    };
    try {
      return await new Promise<MiniGameResult>((res, rej) => {
        signal.addEventListener('abort', () => rej(signal.reason), { once: true });
        fabrica(ctx, config).then(res, (e) => {
          console.error(`[escenario-engine] el minijuego "${clave}" falló`, e);
          res({ exito: false }); // nunca castigar: se toma la rama siNo
        });
      });
    } finally {
      assets.liberar(new Set(this.textures.getTextureKeys()));
      this.scene.remove(key);
      this.scene.resume();
      this.cameras.main.fadeIn(300);
    }
  }

  // --- Ciclo ---

  override update(_t: number, delta: number) {
    if (!this.listo) return;
    const dt = Math.min(delta, 50) / 1000;
    const j = this.jugador;
    if (j) {
      if (!this.runtime.activo && this.teclas) {
        const k = this.teclas;
        const dx = (+(k.der.isDown || k.d.isDown)) - (+(k.izq.isDown || k.a.isDown));
        const dy = (+(k.abajo.isDown || k.s.isDown)) - (+(k.arriba.isDown || k.w.isDown));
        if ((dx || dy) && j.caminando) { this.intento++; j.detener(); }
        j.empujar(dx, dy, dt, this.caminable);
      }
      j.update(dt, this.caminable);
    }
    for (const a of this.npcs.values()) a.update(dt, this.caminable);
    this.proximidad();
    this.comentarios();
    this.moverCamara(dt);
  }

  momento(): NonNullable<SaveBlob['momento']> {
    return {
      ...(this.jugador && { jugador: { x: Math.round(this.jugador.pos.x), y: Math.round(this.jugador.pos.y), mira: this.jugador.mira } }),
      camara: { x: Math.round(this.cameras.main.scrollX) },
      tiempo: Math.round((this.time.now - this.inicio) / 1000),
    };
  }

  aplicarEscala(e: Escala) {
    this.d.escala = e;
    this.flecha?.setScale(e.ui);
    this.cercano?.icono.setScale(e.ui);
  }

  private dibujarDebug() {
    const g = this.add.graphics().setDepth(3e6);
    const dibujar = (f: Forma, color: number) => {
      g.lineStyle(2, color, 0.9);
      if (f.tipo === 'poligono') g.strokePoints(f.puntos.map((p) => new Phaser.Math.Vector2(p.x, p.y)), true);
      else if (f.tipo === 'rect') g.strokeRect(f.x, f.y, f.w, f.h);
      else g.strokeEllipse(f.x + f.w / 2, f.y + f.h / 2, f.w, f.h);
    };
    this.m.pisos.forEach((p) => dibujar({ tipo: 'poligono', puntos: p }, 0x22cc55));
    this.huellas.forEach((h) => dibujar(h, 0xff3333));
    this.interactuables.forEach((i) => dibujar(i.ent.hotspot, 0xffcc00));
    this.m.zonas.forEach((z) => dibujar(z.forma, 0x3399ff));
  }
}
