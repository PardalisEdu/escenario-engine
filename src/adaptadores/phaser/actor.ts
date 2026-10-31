// Un personaje que camina dentro del piso: el jugador o un NPC (§7).
import * as Phaser from 'phaser';
import type { Mira, Vec } from '../../core/esquema';
import { avanzar, llego } from '../../core/geometria';

export type Anim = 'idle' | 'caminar' | 'hablar';

export class Actor {
  sprite: Phaser.GameObjects.Sprite;
  pos: Vec;
  mira: Mira = 'derecha';
  private destino?: Vec;
  private alLlegar?: () => void;
  private t = 0;
  private actual?: Anim;

  constructor(
    private scene: Phaser.Scene,
    pie: Vec,
    textura: string,
    private anims: Partial<Record<Anim, string>> = {},
    private vx = 240,
    private vy = 110,
    private bob = true,
  ) {
    this.pos = { ...pie };
    this.sprite = scene.add.sprite(pie.x, pie.y, textura).setOrigin(0.5, 1);
    this.animar('idle');
    this.sincronizar();
  }

  get caminando() { return !!this.destino; }

  mirar(m: Mira) {
    this.mira = m;
    this.sprite.setFlipX(m === 'izquierda');
  }

  animar(a: Anim) {
    if (this.actual === a) return;
    this.actual = a;
    const clave = this.anims[a] ?? (a === 'hablar' ? this.anims.idle : undefined);
    if (clave && this.scene.anims.exists(clave)) this.sprite.play(clave);
    else this.sprite.stop();
  }

  /** Camina hasta `destino`. La promesa se resuelve al llegar, al atorarse o con detener(). */
  caminarA(destino: Vec): Promise<void> {
    this.alLlegar?.();
    this.destino = destino;
    return new Promise((res) => (this.alLlegar = res));
  }

  detener() {
    this.destino = undefined;
    this.animar('idle');
    const fin = this.alLlegar;
    this.alLlegar = undefined;
    fin?.();
  }

  /** Teclado: mueve en la dirección dada (-1..1 por eje). */
  empujar(dx: number, dy: number, dt: number, caminable: (p: Vec) => boolean) {
    if (!dx && !dy) {
      if (!this.destino) this.animar('idle');
      return;
    }
    this.destino = undefined;
    this.paso({ x: this.pos.x + dx * 1e4, y: this.pos.y + dy * 1e4 }, dt, caminable);
  }

  update(dt: number, caminable: (p: Vec) => boolean) {
    if (this.destino) {
      const antes = this.pos;
      this.paso(this.destino, dt, caminable);
      if (llego(this.pos, this.destino) || this.pos === antes) this.detener();
    }
    this.sincronizar();
  }

  colocar(p: Vec) {
    this.pos = { ...p };
    this.sincronizar();
  }

  private paso(destino: Vec, dt: number, caminable: (p: Vec) => boolean) {
    const nuevo = avanzar(this.pos, destino, this.vx, this.vy, dt, caminable);
    if (nuevo === this.pos) return;
    if (Math.abs(nuevo.x - this.pos.x) > 0.01) this.mirar(nuevo.x < this.pos.x ? 'izquierda' : 'derecha');
    this.pos = nuevo;
    this.t += dt;
    this.animar('caminar');
  }

  private sincronizar() {
    // Sin animación de caminar: se desliza con un bob suave de 2 px.
    const bob = this.bob && this.caminando && !this.anims.caminar ? Math.abs(Math.sin(this.t * 12)) * -2 : 0;
    this.sprite.setPosition(this.pos.x, this.pos.y + bob).setDepth(this.pos.y);
  }
}
