/**
 * Voz y señales sonoras. Todo aviso tiene sonido, porque las niñas y los niños aún no leen con soltura.
 *
 * - Si existe la voz grabada, se reproduce.
 * - Si no, se usa la voz sintetizada del navegador (TTS) en el idioma del personaje.
 * - Si el navegador no tiene TTS, se espera un tiempo proporcional al largo del texto.
 */
import * as Phaser from 'phaser';
import type { Idioma } from '../../core/esquema';

const CODIGO_DE_IDIOMA: Record<Idioma, string> = { es: 'es-MX', en: 'en-US' };

export class Voz {
  private sonidoActual?: Phaser.Sound.BaseSound;
  private enunciadoActual?: SpeechSynthesisUtterance;

  constructor(private readonly escena: Phaser.Scene) {}

  /** Dice un texto. La promesa termina cuando acaba de hablar (o al cancelar). */
  async decir(texto: string, idioma: Idioma, claveDeAudio?: string, cancelacion?: AbortSignal): Promise<void> {
    if (cancelacion?.aborted) return;

    if (claveDeAudio && this.escena.cache.audio.exists(claveDeAudio)) {
      await this.reproducirGrabacion(claveDeAudio, cancelacion);
      return;
    }
    if (claveDeAudio) {
      console.warn(`[escenario-engine] audio "${claveDeAudio}" no disponible; se usa TTS`);
    }
    await this.decirConVozSintetizada(texto, idioma, cancelacion);
  }

  /** Corta lo que se esté diciendo. */
  callar(): void {
    this.sonidoActual?.destroy();
    this.sonidoActual = undefined;
    if (this.enunciadoActual) {
      this.enunciadoActual = undefined;
      globalThis.speechSynthesis?.cancel();
    }
  }

  /** Una señal corta (toque, cercanía). Si el nivel no trae su propio sonido, se sintetiza un tono. */
  tocarSenal(claveDeAudio: string | undefined, frecuenciaDeRespaldo: number): void {
    if (claveDeAudio && this.escena.cache.audio.exists(claveDeAudio)) {
      this.escena.sound.play(claveDeAudio);
    } else {
      tocarTono(this.escena, frecuenciaDeRespaldo);
    }
  }

  private reproducirGrabacion(clave: string, cancelacion?: AbortSignal): Promise<void> {
    const sonido = this.escena.sound.add(clave);
    this.sonidoActual = sonido;
    return new Promise((terminar) => {
      const limpiarYTerminar = () => {
        if (this.sonidoActual === sonido) this.sonidoActual = undefined;
        cancelacion?.removeEventListener('abort', alAbortar);
        terminar();
      };
      const alAbortar = () => {
        sonido.destroy();
        limpiarYTerminar();
      };
      sonido.once('complete', () => {
        sonido.destroy();
        limpiarYTerminar();
      });
      sonido.once('destroy', limpiarYTerminar); // callar() destruye el sonido
      cancelacion?.addEventListener('abort', alAbortar, { once: true });
      sonido.play();
    });
  }

  private decirConVozSintetizada(texto: string, idioma: Idioma, cancelacion?: AbortSignal): Promise<void> {
    const sintetizador = globalThis.speechSynthesis;
    if (!sintetizador) {
      const milisegundosEstimados = Math.max(1500, texto.length * 60);
      return new Promise((terminar) => {
        const temporizador = setTimeout(terminar, milisegundosEstimados);
        cancelacion?.addEventListener('abort', () => { clearTimeout(temporizador); terminar(); }, { once: true });
      });
    }

    return new Promise((terminar) => {
      const enunciado = new SpeechSynthesisUtterance(texto);
      this.enunciadoActual = enunciado;
      enunciado.lang = CODIGO_DE_IDIOMA[idioma];
      const finalizar = () => {
        if (this.enunciadoActual === enunciado) this.enunciadoActual = undefined;
        cancelacion?.removeEventListener('abort', alAbortar);
        terminar();
      };
      const alAbortar = () => {
        // Solo cancela el sintetizador si este enunciado sigue siendo el activo (evita cortar una línea nueva).
        if (this.enunciadoActual === enunciado) {
          this.enunciadoActual = undefined;
          sintetizador.cancel();
        }
        terminar();
      };
      enunciado.onend = finalizar;
      enunciado.onerror = finalizar;
      cancelacion?.addEventListener('abort', alAbortar, { once: true });
      sintetizador.speak(enunciado);
    });
  }
}

/** Un tono breve generado con Web Audio. No hace nada si el audio está apagado o no hay Web Audio. */
export function tocarTono(escena: Phaser.Scene, frecuencia: number, duracionEnSegundos = 0.15): void {
  const sonido = escena.sound;
  if (!(sonido instanceof Phaser.Sound.WebAudioSoundManager) || sonido.mute) return;

  const contexto = sonido.context;
  const oscilador = contexto.createOscillator();
  const volumen = contexto.createGain();
  oscilador.frequency.value = frecuencia;
  // Empieza suave y se apaga rápido para que suene como un "tin" y no como un pitido.
  volumen.gain.setValueAtTime(0.15, contexto.currentTime);
  volumen.gain.exponentialRampToValueAtTime(0.001, contexto.currentTime + duracionEnSegundos);
  oscilador.connect(volumen).connect(contexto.destination);
  oscilador.start();
  oscilador.stop(contexto.currentTime + duracionEnSegundos);
}
