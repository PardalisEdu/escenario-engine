// Globos, opciones de elige, voz (audio grabado o TTS) y señales sonoras.
import * as Phaser from 'phaser';
import type { Opcion } from '../../core/esquema';

export interface Escala { ui: number; globos: number; textoMinimo: number; borde: number }

export const ESCALA_NORMAL: Escala = { ui: 1, globos: 1, textoMinimo: 22, borde: 3 };

const LANG = { es: 'es-MX', en: 'en-US' } as const;
export type Idioma = keyof typeof LANG;

// --- Voz ---

export class Voz {
  private sonido?: Phaser.Sound.BaseSound;

  constructor(private scene: Phaser.Scene) {}

  /** Reproduce el audio grabado si existe; si no, TTS en el idioma dado. Resuelve al terminar. */
  async decir(texto: string, idioma: Idioma, audio?: string, signal?: AbortSignal): Promise<void> {
    if (signal?.aborted) return;
    if (audio && this.scene.cache.audio.exists(audio)) {
      const s = (this.sonido = this.scene.sound.add(audio));
      await new Promise<void>((res) => {
        s.once('complete', res);
        s.once('destroy', res);
        signal?.addEventListener('abort', () => res(), { once: true });
        s.play();
      });
      s.destroy();
      return;
    }
    if (audio) console.warn(`[escenario-engine] audio "${audio}" no disponible; se usa TTS`);
    const tts = globalThis.speechSynthesis;
    if (!tts) return new Promise((res) => setTimeout(res, Math.max(1500, texto.length * 60)));
    await new Promise<void>((res) => {
      const u = new SpeechSynthesisUtterance(texto);
      u.lang = LANG[idioma];
      u.onend = u.onerror = () => res();
      signal?.addEventListener('abort', () => { tts.cancel(); res(); }, { once: true });
      tts.speak(u);
    });
  }

  callar() {
    this.sonido?.destroy();
    globalThis.speechSynthesis?.cancel();
  }

  tocar(clave: string | undefined, frecuencia: number) {
    if (clave && this.scene.cache.audio.exists(clave)) this.scene.sound.play(clave);
    else tono(this.scene, frecuencia);
  }
}

/** Señal corta sintetizada cuando el nivel no trae un sonido propio. */
export function tono(scene: Phaser.Scene, frecuencia: number, dur = 0.15) {
  const ctx = (scene.sound as Partial<Phaser.Sound.WebAudioSoundManager>).context;
  if (!ctx || scene.sound.mute) return;
  const osc = ctx.createOscillator(), gain = ctx.createGain();
  osc.frequency.value = frecuencia;
  gain.gain.setValueAtTime(0.15, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
  osc.connect(gain).connect(ctx.destination);
  osc.start();
  osc.stop(ctx.currentTime + dur);
}

// --- Globo de diálogo ---

export class Globo {
  readonly contenedor: Phaser.GameObjects.Container;
  private texto: Phaser.GameObjects.Text;
  private completo: string;
  private timer?: Phaser.Time.TimerEvent;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    texto: string,
    e: Escala,
    opts: { trad?: string; palabra?: string; velocidad?: number } = {},
  ) {
    const fs = Math.max(26 * e.globos, e.textoMinimo);
    const ancho = 520 * e.globos;
    const pad = 18 * e.globos;
    this.completo = texto;
    this.texto = scene.add.text(0, 0, texto, { fontFamily: 'sans-serif', fontSize: fs, color: '#1d1d1b', wordWrap: { width: ancho - pad * 2 } });
    const hijos: Phaser.GameObjects.GameObject[] = [];
    let alto = this.texto.height;
    let trad: Phaser.GameObjects.Text | undefined;
    if (opts.trad) {
      trad = scene.add.text(0, alto + 8, opts.trad, { fontFamily: 'sans-serif', fontSize: fs * 0.75, fontStyle: 'italic', color: '#5a4a3a', wordWrap: { width: ancho - pad * 2 } });
      alto += trad.height + 8;
    }
    const w = Math.min(ancho, Math.max(this.texto.width, trad?.width ?? 0) + pad * 2);
    const h = alto + pad * 2;
    // Placa semitransparente: contraste garantizado sobre cualquier fondo.
    const placa = scene.add.graphics()
      .fillStyle(0xffffff, 0.94).fillRoundedRect(-w / 2, -h, w, h, 18)
      .lineStyle(e.borde, 0x1d1d1b, 1).strokeRoundedRect(-w / 2, -h, w, h, 18)
      .fillStyle(0xffffff, 0.94).fillTriangle(-12, -1, 12, -1, 0, 16);
    this.texto.setPosition(-w / 2 + pad, -h + pad);
    trad?.setPosition(-w / 2 + pad, -h + pad + this.texto.height + 8);
    hijos.push(placa, this.texto, ...(trad ? [trad] : []));
    if (opts.palabra) {
      // Tarjeta de vocabulario: resalta la palabra encima del globo.
      const p = scene.add.text(0, -h - 14, opts.palabra, { fontFamily: 'sans-serif', fontSize: fs * 1.2, fontStyle: 'bold', color: '#ffffff', backgroundColor: '#e2572b', padding: { x: 14, y: 6 } }).setOrigin(0.5, 1);
      hijos.push(p);
    }
    const cam = scene.cameras.main.worldView;
    const cx = Phaser.Math.Clamp(x, cam.x + w / 2 + 8, cam.right - w / 2 - 8);
    this.contenedor = scene.add.container(cx, Math.max(y, h + 70 * e.globos), hijos).setDepth(1e6);

    const ms = opts.velocidad ?? 30;
    if (ms > 0 && texto.length > 1) {
      this.texto.setText('');
      let i = 0;
      this.timer = scene.time.addEvent({ delay: ms, repeat: texto.length - 1, callback: () => this.texto.setText(texto.slice(0, ++i)) });
    }
  }

  get escribiendo() { return this.texto.text.length < this.completo.length; }

  completar() {
    this.timer?.remove();
    this.texto.setText(this.completo);
  }

  destroy() {
    this.timer?.remove();
    this.contenedor.destroy();
  }
}

// --- Opciones de elige (fijas a la pantalla) ---

export function mostrarOpciones(
  scene: Phaser.Scene,
  pregunta: string,
  opciones: Opcion[],
  e: Escala,
  alElegir: (i: number) => void,
): { destroy(): void; resaltar(i: number): void } {
  const { width, height } = scene.scale;
  const objs: Phaser.GameObjects.GameObject[] = [];
  const fs = Math.max(24 * e.ui, e.textoMinimo);
  const titulo = scene.add.text(width / 2, 30 * e.ui, pregunta, { fontFamily: 'sans-serif', fontSize: fs, color: '#1d1d1b', backgroundColor: '#ffffffee', padding: { x: 16, y: 10 }, align: 'center', wordWrap: { width: width * 0.8 } })
    .setOrigin(0.5, 0).setScrollFactor(0).setDepth(2e6);
  objs.push(titulo);
  const bw = Math.min(260 * e.ui, (width - 40) / opciones.length - 16);
  const bh = 150 * e.ui;
  const y = height - bh - 30 * e.ui;
  const dibujos: ((activo: boolean) => void)[] = [];
  opciones.forEach((o, i) => {
    const x = width / 2 + (i - (opciones.length - 1) / 2) * (bw + 16) - bw / 2;
    const g = scene.add.graphics().setScrollFactor(0).setDepth(2e6);
    const dibujar = (activo: boolean) => g.clear()
      .fillStyle(activo ? 0xfff1c9 : 0xffffff, 0.96).fillRoundedRect(x, y, bw, bh, 20)
      .lineStyle(e.borde * (activo ? 2 : 1), 0x1d1d1b, 1).strokeRoundedRect(x, y, bw, bh, 20);
    dibujar(false);
    dibujos.push(dibujar);
    const zona = scene.add.zone(x, y, bw, bh).setOrigin(0).setScrollFactor(0).setDepth(2e6).setInteractive({ useHandCursor: true });
    zona.on('pointerdown', (_p: unknown, _x: number, _y: number, ev: Phaser.Types.Input.EventData) => { ev.stopPropagation(); alElegir(i); });
    zona.on('pointerover', () => dibujar(true));
    zona.on('pointerout', () => dibujar(false));
    objs.push(g, zona);
    if (o.imagen && scene.textures.exists(o.imagen)) {
      const img = scene.add.image(x + bw / 2, y + bh * 0.42, o.imagen).setScrollFactor(0).setDepth(2e6);
      img.setScale(Math.min((bw * 0.8) / img.width, (bh * 0.6) / img.height));
      objs.push(img);
    }
    if (o.texto) {
      objs.push(scene.add.text(x + bw / 2, y + bh - 10, o.texto, { fontFamily: 'sans-serif', fontSize: fs * 0.85, color: '#1d1d1b', align: 'center', wordWrap: { width: bw - 16 } })
        .setOrigin(0.5, 1).setScrollFactor(0).setDepth(2e6));
    }
    objs.push(scene.add.text(x + 10, y + 8, String(i + 1), { fontFamily: 'sans-serif', fontSize: fs * 0.6, color: '#8a7a6a' }).setScrollFactor(0).setDepth(2e6));
  });
  return {
    destroy: () => objs.forEach((o) => o.destroy()),
    resaltar: (i) => dibujos.forEach((d, j) => d(i === j)),
  };
}

/** Pantalla de carga sin texto: una barra ilustrada que se llena. */
export function barraDeCarga(scene: Phaser.Scene) {
  const { width, height } = scene.scale;
  const g = scene.add.graphics();
  scene.load.on('progress', (p: number) => {
    g.clear()
      .fillStyle(0xffffff, 0.6).fillRoundedRect(width * 0.2, height / 2 - 18, width * 0.6, 36, 18)
      .fillStyle(0xe2572b, 1).fillRoundedRect(width * 0.2 + 4, height / 2 - 14, Math.max(28, (width * 0.6 - 8) * p), 28, 14);
  });
  scene.load.once('complete', () => g.destroy());
}
