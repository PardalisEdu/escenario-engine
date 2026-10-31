/**
 * La escena de Phaser de un nivel. Aquí se conectan todas las piezas:
 *
 *   construir-mundo.ts   dibuja capas, props y actores
 *   camara.ts            mueve la cámara
 *   avisos.ts            resalta lo interactivo cercano
 *   comentarios.ts       comentarios del jugador por zona
 *   conversacion.ts      globos, opciones y voz
 *   minijuego.ts         monta y desmonta minijuegos
 *   efectos.ts           partículas y sonidos de los pasos "efecto"
 *   acompanante.ts       el acompañante que sigue al jugador
 *   cinematica.ts        franjas de cine y botón para saltar la intro
 *   titulo.ts            tarjeta de título de los pasos "titulo"
 *
 * Esta clase también es el PlayerController (§7.2): recibe toques y teclado,
 * y es el "mundo" que usa el DialogueRuntime para ejecutar los pasos.
 *
 * Ciclo de vida de Phaser: preload() carga los assets → create() arma todo → update() cada cuadro.
 */
import * as Phaser from 'phaser';
import { DialogueRuntime, type AccionesDelMundo, type MiniGameResult } from '../../core/dialogo';
import type { DestinoCamina, Idioma, Linea, Opcion, PasosOSecuencia, Punto } from '../../core/esquema';
import type { GameState } from '../../core/estado';
import { ajustarAlPiso, cajaDeForma, puntoDentroDeForma, puntoDentroDePoligono } from '../../core/geometria';
import type { SaveBlob } from '../../core/partida';
import { EscenarioError, type Nivel } from '../../core/validar';
import { SeguimientoDelAcompanante } from './acompanante';
import type { Actor } from './actor';
import { GestorDeAssets, listaDeAssetsDelNivel } from './assets';
import { AvisosDeCercania } from './avisos';
import { mostrarBarraDeCarga } from './barra-de-carga';
import { Camara } from './camara';
import { Cinematica, esperarEnLaEscena } from './cinematica';
import { ComentariosPorZona } from './comentarios';
import { construirMundo, type ElementosDelMundo, type Interactuable } from './construir-mundo';
import { Conversacion } from './conversacion';
import { dibujarOverlayDeDepuracion } from './depuracion';
import { crearTexturaDeChispa, reproducirEfecto } from './efectos';
import { FlechaDeSalida } from './flecha-de-salida';
import { PROFUNDIDAD, type EscalaDeInterfaz } from './interfaz';
import { jugarMinijuego, type MiniGameFactory } from './minijuego';
import { mostrarTarjetaDeTitulo } from './titulo';

export interface DatosDeLaEscena {
  nivel: Nivel;
  estado: GameState;
  partida?: SaveBlob;
  assetsRoot: string;
  cdn: string[];
  minijuegos: Record<string, MiniGameFactory>;
  idiomaBase: Idioma;
  escala: EscalaDeInterfaz;
  /** Número al azar entre 0 y 1 (con semilla en pruebas). */
  azar: () => number;
  mostrarDepuracion: boolean;

  // Avisos hacia el motor
  alEstarLista: () => void;
  alFallar: (error: Error) => void;
  alVerPalabra: (palabra: { en: string; es: string }) => void;
  alSalir: (destino: string) => void;
}

/** Un arrastre de menos de esto (en píxeles) cuenta como toque. */
const UMBRAL_DE_ARRASTRE = 8;

/** Frecuencias de los tonos de respaldo cuando el nivel no trae sonidos propios. */
const TONO_DE_TOQUE = 520;
const TONO_DE_CERCANIA = 880;

/** Tiempo máximo de un cuadro; evita saltos enormes después de una pausa o de cambiar de pestaña. */
const MAXIMO_DE_MILISEGUNDOS_POR_CUADRO = 50;

type TeclasDeMovimiento = Record<'arriba' | 'abajo' | 'izquierda' | 'derecha' | 'w' | 'a' | 's' | 'd', Phaser.Input.Keyboard.Key>;

export class EscenaMundo extends Phaser.Scene implements AccionesDelMundo {
  /** Existe solo después de que la escena se creó bien. */
  runtime?: DialogueRuntime;
  /** true cuando terminó create() sin errores. */
  lista = false;

  private gestorDeAssets!: GestorDeAssets;
  private elementos!: ElementosDelMundo;
  private camara!: Camara;
  private avisos!: AvisosDeCercania;
  private comentarios!: ComentariosPorZona;
  private conversacion!: Conversacion;
  private flecha?: FlechaDeSalida;
  private teclas?: TeclasDeMovimiento;
  private acompanante?: SeguimientoDelAcompanante;
  /** Existe solo mientras corre la intro. */
  private cinematica?: Cinematica;

  /** El toque en curso: dónde empezó y si ya se convirtió en arrastre. */
  private toque?: { inicio: Punto; esArrastre: boolean; sobreUnBoton: boolean };
  /**
   * Sube con cada nueva orden de movimiento (toque o teclado). Una caminata hacia un NPC
   * compara su número al llegar: si cambió, otra orden la reemplazó y ya no debe hablar.
   */
  private ordenDeMovimiento = 0;
  private momentoDeInicio = 0;

  constructor(private readonly datos: DatosDeLaEscena) {
    super('escenario');
  }

  private get contenido() {
    return this.datos.nivel.contenido;
  }

  private get mundo() {
    return this.datos.nivel.mundo;
  }

  // ─── Ciclo de vida ─────────────────────────────────────────────────────────

  preload(): void {
    mostrarBarraDeCarga(this);
    this.gestorDeAssets = new GestorDeAssets(this, this.datos.assetsRoot, this.datos.cdn);
    this.gestorDeAssets.encolar(listaDeAssetsDelNivel(this.contenido, this.mundo));
  }

  create(): void {
    // Fase 5 de la validación: si falta una imagen, el nivel no arranca.
    const errores = this.gestorDeAssets.erroresQueImpidenArrancar();
    if (errores.length > 0) {
      this.datos.alFallar(new EscenarioError(errores));
      return;
    }
    for (const falla of this.gestorDeAssets.audiosQueFaltan()) {
      console.warn(`[escenario-engine] audio ${falla.clave} no cargado (${falla.detalle}); se usará TTS`);
    }

    const segundosYaJugados = this.datos.partida?.momento?.tiempo ?? 0;
    this.momentoDeInicio = this.time.now - segundosYaJugados * 1000;

    crearTexturaDeChispa(this);
    this.elementos = construirMundo(this, this.datos.nivel, this.datos.partida);
    this.crearSeguimientoDelAcompanante();
    this.crearFlechaDeSalida();
    this.crearPiezas();
    this.configurarEntrada();
    if (this.datos.mostrarDepuracion) dibujarOverlayDeDepuracion(this, this.mundo, this.elementos);
    this.empezarMusica();

    this.runtime = new DialogueRuntime(this.contenido, this.datos.estado, this);
    this.datos.estado.alCambiar = () => this.actualizarFlecha();
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.cinematica?.destruir();
      this.cinematica = undefined;
      this.datos.estado.alCambiar = undefined;
      this.avisos.quitar();
      this.conversacion.cancelarComentario();
      this.conversacion.callar();
      this.runtime?.abort();
    });

    this.lista = true;
    this.datos.alEstarLista();

    // La intro se ve al empezar el nivel por primera vez; quien vuelve con una partida guardada ya la vio.
    if (this.contenido.intro && !this.datos.partida) this.reproducirIntro(this.contenido.intro);
  }

  override update(_tiempo: number, milisegundos: number): void {
    if (!this.lista || !this.runtime) return;
    const segundos = Math.min(milisegundos, MAXIMO_DE_MILISEGUNDOS_POR_CUADRO) / 1000;
    const jugador = this.elementos.jugador;

    if (jugador && !this.runtime.ocupado) this.moverJugadorConTeclado(jugador, segundos);
    jugador?.actualizar(segundos, this.esCaminable);
    if (jugador && this.acompanante) {
      this.acompanante.actualizar(jugador);
      this.acompanante.actor.actualizar(segundos, this.esCaminable);
    }
    for (const npc of this.elementos.npcs.values()) npc.actualizar(segundos, this.esCaminable);

    if (jugador && !this.runtime.ocupado) {
      this.avisos.actualizar(jugador.posicion, this.contenido.jugador!.radioAviso);
      this.comentarios.actualizar(jugador.posicion, this.time.now, !this.conversacion.hayUnComentario);
    } else {
      this.avisos.quitar();
    }

    // Un "enfoca" deja la cámara quieta hasta que termina el diálogo; luego vuelve sola al jugador.
    if (this.camara.estaEnfocada && !this.runtime.ocupado) this.camara.soltarEnfoque();
    this.camara.actualizar(segundos);
    this.cinematica?.actualizar();
  }

  // ─── Armado ────────────────────────────────────────────────────────────────

  private crearPiezas(): void {
    const sonidos = this.contenido.mundo.sonidos;

    this.camara = new Camara(this, this.contenido.mundo.camara, this.mundo, this.elementos.jugador);
    this.camara.colocarAlInicio(this.datos.partida?.momento?.camara?.x);

    this.conversacion = new Conversacion({
      escena: this,
      contenido: this.contenido,
      idiomaBase: this.datos.idiomaBase,
      escala: this.datos.escala,
      buscarActor: (hablante) => this.actorQueHabla(hablante),
      alVerPalabra: this.datos.alVerPalabra,
    });

    this.avisos = new AvisosDeCercania(this, this.elementos.interactuables, this.datos.escala, () =>
      this.conversacion.voz.tocarSenal(sonidos?.cerca, TONO_DE_CERCANIA),
    );

    this.comentarios = new ComentariosPorZona(this.mundo.zonasDeComentario, this.contenido.comentarios, this.datos.azar, (linea) =>
      this.conversacion.decirComentario(linea, this.datos.estado.completarTexto(linea.texto)),
    );
  }

  private crearSeguimientoDelAcompanante(): void {
    const actor = this.elementos.acompanante;
    const datos = this.contenido.acompanante;
    if (actor && datos) this.acompanante = new SeguimientoDelAcompanante(actor, datos.distancia, this.mundo.pisos);
  }

  /** Corre los pasos de la intro dentro del marco de cine. Saltarla aborta el diálogo y quita el marco. */
  private async reproducirIntro(intro: PasosOSecuencia): Promise<void> {
    const cinematica = new Cinematica(this, this.datos.escala, () => this.saltarIntro());
    this.cinematica = cinematica;
    cinematica.empezar();

    await this.runtime?.ejecutar(intro);

    const laEscenaSeCerro = this.cinematica !== cinematica;
    if (laEscenaSeCerro) return;
    this.cinematica = undefined;
    await cinematica.terminar();
  }

  private saltarIntro(): void {
    if (this.cinematica) this.runtime?.abort();
  }

  private crearFlechaDeSalida(): void {
    const salida = this.mundo.salida;
    if (!salida?.conFlecha || !this.contenido.salida) return;
    const leyenda = this.contenido.salida.flecha?.texto;
    this.flecha = new FlechaDeSalida(this, salida, this.mundo.ancho, this.datos.escala.botones, leyenda);
    this.actualizarFlecha();
  }

  private actualizarFlecha(): void {
    this.flecha?.mostrar(this.datos.estado.cumple(this.contenido.salida?.flecha?.visibleCuando));
  }

  private empezarMusica(): void {
    const musica = this.contenido.mundo.sonidos?.musica;
    if (musica && this.cache.audio.exists(musica)) {
      this.sound.play(musica, { loop: true, volume: 0.4 });
    }
  }

  /** Puntos donde se puede estar: dentro de algún piso y fuera de toda huella. */
  private esCaminable = (punto: Punto): boolean => {
    const sobreElPiso = this.mundo.pisos.some((poligono) => puntoDentroDePoligono(punto, poligono));
    const sobreUnaHuella = this.elementos.huellas.some((huella) => puntoDentroDeForma(punto, huella));
    return sobreElPiso && !sobreUnaHuella;
  };

  // ─── Entrada: toques y teclado (§7.2) ──────────────────────────────────────

  private configurarEntrada(): void {
    const teclado = this.input.keyboard;
    if (teclado) {
      const K = Phaser.Input.Keyboard.KeyCodes;
      this.teclas = teclado.addKeys(
        {
          arriba: K.UP, abajo: K.DOWN, izquierda: K.LEFT, derecha: K.RIGHT,
          w: K.W, a: K.A, s: K.S, d: K.D,
        },
        false, // enableCapture=false para no bloquear inputs HTML que monte el host
      ) as TeclasDeMovimiento;
      teclado.on('keydown', (evento: KeyboardEvent) => this.alPresionarTecla(evento));
    }

    this.input.on('pointerdown', (puntero: Phaser.Input.Pointer, objetosDebajo: Phaser.GameObjects.GameObject[]) => {
      this.toque = { inicio: { x: puntero.x, y: puntero.y }, esArrastre: false, sobreUnBoton: objetosDebajo.length > 0 };
      if (this.camara.seArrastra) this.camara.empezarArrastre();
    });

    this.input.on('pointermove', (puntero: Phaser.Input.Pointer) => {
      const toque = this.toque;
      if (!toque || !puntero.isDown) return;
      const desplazamiento = { x: puntero.x - toque.inicio.x, y: puntero.y - toque.inicio.y };
      if (Math.hypot(desplazamiento.x, desplazamiento.y) > UMBRAL_DE_ARRASTRE) toque.esArrastre = true;
      if (toque.esArrastre && this.camara.seArrastra) this.camara.arrastrar(desplazamiento);
    });

    this.input.on('pointerup', (puntero: Phaser.Input.Pointer) => {
      const toque = this.toque;
      this.toque = undefined;
      this.camara.soltarArrastre();
      // Los botones (opciones de elige) atienden su propio toque.
      if (toque && !toque.esArrastre && !toque.sobreUnBoton) {
        this.alTocar({ x: puntero.worldX, y: puntero.worldY });
      }
    });
  }

  private alPresionarTecla(evento: KeyboardEvent): void {
    const objetivo = evento.target as HTMLElement | null;
    if (objetivo && (objetivo.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(objetivo.tagName))) return;
    if (evento.ctrlKey || evento.altKey || evento.metaKey) return;

    if (evento.key === 'Escape') {
      this.saltarIntro();
      return;
    }

    const esEnterOEspacio = evento.key === 'Enter' || evento.key === ' ';
    if (esEnterOEspacio) {
      if (this.runtime?.ocupado) this.conversacion.avanzar();
      else if (this.avisos.cercano) this.interactuarCon(this.avisos.cercano);
      return;
    }

    const numero = Number(evento.key);
    if (numero >= 1 && numero <= 9) this.conversacion.elegirConTeclado(numero - 1);
  }

  /** Flechas o WASD → dirección de -1 a 1 en cada eje. */
  private direccionDelTeclado(): Punto {
    const teclas = this.teclas;
    if (!teclas) return { x: 0, y: 0 };
    let x = 0;
    let y = 0;
    if (teclas.izquierda.isDown || teclas.a.isDown) x -= 1;
    if (teclas.derecha.isDown || teclas.d.isDown) x += 1;
    if (teclas.arriba.isDown || teclas.w.isDown) y -= 1;
    if (teclas.abajo.isDown || teclas.s.isDown) y += 1;
    return { x, y };
  }

  private moverJugadorConTeclado(jugador: Actor, segundos: number): void {
    const direccion = this.direccionDelTeclado();
    const hayTeclas = direccion.x !== 0 || direccion.y !== 0;
    // El teclado cancela una caminata iniciada con un toque.
    if (hayTeclas && jugador.caminando) {
      this.ordenDeMovimiento++;
      jugador.detener();
    }
    jugador.moverConTeclado(direccion, segundos, this.esCaminable);
  }

  private alTocar(punto: Punto): void {
    this.conversacion.voz.tocarSenal(this.contenido.mundo.sonidos?.tap, TONO_DE_TOQUE);
    const tocado = this.interactuableEn(punto);

    // Durante un diálogo, tocar avanza la línea y nunca mueve al jugador.
    if (this.runtime?.ocupado) {
      const avanzo = this.conversacion.avanzar();
      if (!avanzo && tocado && !this.conversacion.hayOpcionesEnPantalla) this.mostrarOcupado(tocado);
      return;
    }

    if (tocado) {
      this.interactuarCon(tocado);
      return;
    }

    const jugador = this.elementos.jugador;
    if (jugador) {
      this.ordenDeMovimiento++;
      jugador.caminarA(ajustarAlPiso(punto, this.mundo.pisos));
    }
  }

  /** Si varios hotspots se enciman, gana el que está más adelante (y de pie mayor). */
  private interactuableEn(punto: Punto): Interactuable | undefined {
    const tocados = this.elementos.interactuables.filter((interactuable) => puntoDentroDeForma(punto, interactuable.entidad.hotspot));
    tocados.sort((a, b) => b.entidad.puntoDePie.y - a.entidad.puntoDePie.y);
    return tocados[0];
  }

  /** Camina hasta el objeto, se voltea hacia él y empieza su diálogo (o intenta salir). */
  private async interactuarCon(interactuable: Interactuable): Promise<void> {
    if (this.runtime?.ocupado) {
      this.mostrarOcupado(interactuable);
      return;
    }

    const jugador = this.elementos.jugador;
    if (jugador) {
      this.ordenDeMovimiento++;
      const miOrden = this.ordenDeMovimiento;
      await jugador.caminarA(this.puntoDeAcercamiento(jugador, interactuable));

      const otraOrdenLaReemplazo = miOrden !== this.ordenDeMovimiento;
      if (otraOrdenLaReemplazo || this.runtime?.ocupado) return;
      this.voltearseUnoAlOtro(jugador, interactuable);
    }

    this.avisos.quitar();
    if (interactuable.tipo === 'salida') this.intentarSalir();
    else this.runtime?.hablarCon(interactuable.tipo, interactuable.id);
  }

  /** El puntoInteraccion del objeto o, si no tiene, el lado más cercano al jugador. */
  private puntoDeAcercamiento(jugador: Actor, interactuable: Interactuable): Punto {
    const { entidad } = interactuable;
    if (entidad.puntoInteraccion) return ajustarAlPiso(entidad.puntoInteraccion, this.mundo.pisos);

    const caja = cajaDeForma(entidad.hotspot);
    const vieneDeLaIzquierda = jugador.posicion.x < entidad.puntoDePie.x;
    const separacion = caja.ancho / 2 + 40;
    const x = vieneDeLaIzquierda ? entidad.puntoDePie.x - separacion : entidad.puntoDePie.x + separacion;
    return ajustarAlPiso({ x, y: entidad.puntoDePie.y + 10 }, this.mundo.pisos);
  }

  private voltearseUnoAlOtro(jugador: Actor, interactuable: Interactuable): void {
    const objetoALaIzquierda = interactuable.entidad.puntoDePie.x < jugador.posicion.x;
    jugador.mirarHacia(objetoALaIzquierda ? 'izquierda' : 'derecha');
    this.elementos.npcs.get(interactuable.id)?.mirarHacia(objetoALaIzquierda ? 'derecha' : 'izquierda');
  }

  /** Si se cumple "salida.requiere" se termina el nivel; si no, se ejecuta "siBloqueada" (§8.7). */
  private intentarSalir(): void {
    const salida = this.contenido.salida;
    if (!salida) return;
    if (this.datos.estado.cumple(salida.requiere)) this.datos.alSalir(salida.destino);
    else if (salida.siBloqueada) this.runtime?.ejecutar(salida.siBloqueada);
  }

  /** Burbuja «…» sobre lo que se tocó mientras ya hay un diálogo: no hay colas. */
  private mostrarOcupado(interactuable: Interactuable): void {
    const caja = cajaDeForma(interactuable.entidad.hotspot);
    const burbuja = this.add
      .text(interactuable.entidad.puntoDePie.x, caja.y, '…', {
        fontSize: 40 * this.datos.escala.globos,
        color: '#1d1d1b',
        backgroundColor: '#ffffff',
        padding: { x: 12, y: 0 },
      })
      .setOrigin(0.5, 1)
      .setDepth(PROFUNDIDAD.globos);
    this.time.delayedCall(800, () => burbuja.destroy());
  }

  // ─── AccionesDelMundo: lo que pide el DialogueRuntime ──────────────────────

  mostrarLinea(linea: Linea, texto: string, cancelacion: AbortSignal): Promise<void> {
    this.avisos.quitar();
    return this.conversacion.mostrarLinea(linea, texto, cancelacion);
  }

  elegirOpcion(pregunta: string, opciones: Opcion[], cancelacion: AbortSignal): Promise<number> {
    return this.conversacion.elegirOpcion(pregunta, opciones, cancelacion);
  }

  /** El efecto aparece sobre el jugador; si no hay jugador, en el centro de la pantalla. */
  reproducirEfecto(nombre: string, cancelacion: AbortSignal): Promise<void> {
    const actor = this.elementos.jugador ?? [...this.elementos.npcs.values()][0];
    const vista = this.cameras.main.worldView;
    const posicion = actor
      ? { x: actor.posicion.x, y: actor.sprite.y - actor.sprite.displayHeight / 2 }
      : { x: vista.centerX, y: vista.centerY };
    return reproducirEfecto(this, nombre, posicion, cancelacion);
  }

  async caminar(quien: string | undefined, destino: DestinoCamina, cancelacion: AbortSignal): Promise<void> {
    const actor = this.actorQueCamina(quien);
    if (!actor) return;

    let objetivo: Punto;
    if (typeof destino === 'number') objetivo = { x: destino, y: actor.posicion.y };
    else if (typeof destino === 'string') objetivo = this.mundo.puntos[destino]!; // la validación garantiza que existe
    else objetivo = destino;

    const alCancelar = () => actor.detener();
    cancelacion.addEventListener('abort', alCancelar, { once: true });
    // Mientras un paso lo guía, el acompañante deja de seguir al jugador.
    const guiaAlAcompanante = this.acompanante?.actor === actor;
    if (guiaAlAcompanante) this.acompanante!.guiado = true;
    try {
      await actor.caminarA(ajustarAlPiso(objetivo, this.mundo.pisos));
    } finally {
      cancelacion.removeEventListener('abort', alCancelar);
      if (guiaAlAcompanante) this.acompanante!.guiado = false;
    }
  }

  jugarMinijuego(clave: string, config: unknown, cancelacion: AbortSignal): Promise<MiniGameResult> {
    return jugarMinijuego({
      escenaDelMundo: this,
      clave,
      fabrica: this.datos.minijuegos[clave]!, // la validación garantiza que está registrada
      config,
      estado: this.datos.estado,
      assetsRoot: this.datos.assetsRoot,
      cdn: this.datos.cdn,
      cancelacion,
    });
  }

  enfocar(objetivo: string | Punto, zoom: number, cancelacion: AbortSignal): Promise<void> {
    return this.camara.enfocar(this.puntoAEnfocar(objetivo), zoom, cancelacion);
  }

  esperar(segundos: number, cancelacion: AbortSignal): Promise<void> {
    return esperarEnLaEscena(this, segundos * 1000, cancelacion);
  }

  mostrarTitulo(texto: string, audio: string | undefined, cancelacion: AbortSignal): Promise<void> {
    this.avisos.quitar();
    const datos = { escena: this, voz: this.conversacion.voz, texto, audio, idioma: this.datos.idiomaBase, escala: this.datos.escala };
    return mostrarTarjetaDeTitulo(datos, cancelacion);
  }

  async hacerGesto(quien: string | undefined, gesto: string, cancelacion: AbortSignal): Promise<void> {
    await this.actorQueCamina(quien)?.hacerGesto(gesto, cancelacion);
  }

  // ─── Para el motor ─────────────────────────────────────────────────────────

  /** Posición del jugador, cámara y tiempo jugado, para la partida guardada. */
  momentoActual(): NonNullable<SaveBlob['momento']> {
    const jugador = this.elementos.jugador;
    const momento: NonNullable<SaveBlob['momento']> = {
      camara: { x: Math.round(this.camara.scrollX) },
      tiempo: Math.round((this.time.now - this.momentoDeInicio) / 1000),
    };
    if (jugador) {
      momento.jugador = { x: Math.round(jugador.posicion.x), y: Math.round(jugador.posicion.y), mira: jugador.mira };
    }
    return momento;
  }

  cambiarEscala(escala: EscalaDeInterfaz): void {
    this.datos.escala = escala;
    this.flecha?.cambiarEscala(escala.botones);
    this.avisos.cambiarEscala(escala);
    this.conversacion.cambiarEscala(escala);
    this.cinematica?.cambiarEscala(escala);
  }

  // ─── Ayudantes ─────────────────────────────────────────────────────────────

  /**
   * Quién dice una línea: el jugador, el NPC con ese id o, si el hablante no está en el mapa,
   * el NPC con el que se está hablando.
   */
  private actorQueHabla(hablante: string): Actor | undefined {
    if (hablante === this.contenido.jugador?.personaje) return this.elementos.jugador;
    if (hablante === this.contenido.acompanante?.personaje) return this.elementos.acompanante;
    const npc = this.elementos.npcs.get(hablante);
    if (npc) return npc;
    const interlocutor = this.runtime?.idDelInterlocutor;
    return interlocutor ? this.elementos.npcs.get(interlocutor) : undefined;
  }

  /** Sin "quien" (o con el id del jugador) se mueve el jugador; si no, el acompañante o el NPC indicado. */
  private actorQueCamina(quien: string | undefined): Actor | undefined {
    if (quien === undefined || quien === this.contenido.jugador?.personaje) return this.elementos.jugador;
    if (quien === this.contenido.acompanante?.personaje) return this.elementos.acompanante;
    return this.elementos.npcs.get(quien);
  }

  /** El centro de un personaje (a media altura) o un lugar del mapa. */
  private puntoAEnfocar(objetivo: string | Punto): Punto {
    if (typeof objetivo !== 'string') return objetivo;
    const actor = this.actorQueCamina(objetivo);
    if (actor) return { x: actor.posicion.x, y: actor.posicion.y - actor.sprite.displayHeight / 2 };
    return this.mundo.puntos[objetivo]!; // la validación garantiza que es un personaje en pantalla o un punto
  }
}
