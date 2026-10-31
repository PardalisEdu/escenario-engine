/**
 * Animación procedural: cómo se deforma el sprite de un personaje para que se vea vivo
 * aunque el nivel no traiga atlas de animación.
 *
 * Cada función devuelve una `Pose` (desplazamiento, giro y escala) para un momento dado.
 * El actor (actor.ts) suma las poses que tocan en cada cuadro y se las aplica al sprite.
 * El sprite tiene su origen abajo al centro, así que escalar o girar lo hace «desde los pies».
 *
 * Con movimiento reducido (accesibilidad) el actor solo usa los gestos, que son parte del contenido.
 */
import type { NombreDeGesto } from '../../core/validar-enlaces';

export interface Pose {
  /** Píxeles hacia arriba (negativo) o abajo (positivo). */
  desplazamientoY: number;
  /** Grados; positivo gira en el sentido del reloj. */
  angulo: number;
  escalaX: number;
  escalaY: number;
}

export const POSE_NEUTRA: Pose = { desplazamientoY: 0, angulo: 0, escalaX: 1, escalaY: 1 };

/** Junta dos poses: los desplazamientos y giros se suman, las escalas se multiplican. */
export function combinarPoses(a: Pose, b: Pose): Pose {
  return {
    desplazamientoY: a.desplazamientoY + b.desplazamientoY,
    angulo: a.angulo + b.angulo,
    escalaX: a.escalaX * b.escalaX,
    escalaY: a.escalaY * b.escalaY,
  };
}

// ─── En reposo ───────────────────────────────────────────────────────────────

const RITMO_DE_RESPIRACION = 2.4; // radianes por segundo: una respiración cada ~2.6 s
const AMPLITUD_DE_RESPIRACION = 0.018;

/** Respirar: el cuerpo se estira un poco hacia arriba y se angosta, muy despacio. */
export function poseDeRespiracion(segundos: number): Pose {
  const respiracion = Math.sin(segundos * RITMO_DE_RESPIRACION) * AMPLITUD_DE_RESPIRACION;
  return { desplazamientoY: 0, angulo: 0, escalaX: 1 - respiracion / 2, escalaY: 1 + respiracion };
}

// ─── Caminando ───────────────────────────────────────────────────────────────

const RITMO_DE_PASOS = 12; // radianes por segundo: un paso cada ~0.26 s
const ALTURA_DEL_REBOTE = 5;
const GRADOS_DE_BALANCEO = 3.5;
/** Inclinación hacia adelante al caminar, en grados. */
const GRADOS_DE_INCLINACION = 3;

/**
 * Caminar. Con atlas de caminar, el dibujo ya mueve las piernas: solo se inclina hacia adelante.
 * Sin atlas, además rebota con cada paso y se balancea de un pie al otro.
 *
 * @param haciaLaDerecha hacia dónde camina, para inclinarse hacia adelante
 */
export function poseDeCaminata(segundosCaminando: number, haciaLaDerecha: boolean, tieneAtlas: boolean): Pose {
  const sentido = haciaLaDerecha ? 1 : -1;
  const inclinacion = GRADOS_DE_INCLINACION * sentido;
  if (tieneAtlas) return { ...POSE_NEUTRA, angulo: inclinacion };

  const fase = segundosCaminando * RITMO_DE_PASOS;
  const pisada = Math.abs(Math.sin(fase)); // 0 = pie en el suelo, 1 = en lo alto del paso
  return {
    desplazamientoY: -ALTURA_DEL_REBOTE * pisada,
    angulo: inclinacion + Math.sin(fase) * GRADOS_DE_BALANCEO,
    // Al tocar el suelo se aplasta un poquito.
    escalaX: 1 + (1 - pisada) * 0.03,
    escalaY: 1 - (1 - pisada) * 0.03,
  };
}

/**
 * Aplastarse al arrancar o frenar, como un resorte. `fuerza` va de 1 (recién arrancó) a 0 (ya pasó).
 */
export function poseDeImpulso(fuerza: number): Pose {
  return { desplazamientoY: 0, angulo: 0, escalaX: 1 + fuerza * 0.07, escalaY: 1 - fuerza * 0.09 };
}

// ─── Hablando ────────────────────────────────────────────────────────────────

const RITMO_AL_HABLAR = 14;

/** Hablar sin atlas: pequeños saltitos del cuerpo, como sílabas. */
export function poseDeHabla(segundos: number): Pose {
  const silaba = Math.abs(Math.sin(segundos * RITMO_AL_HABLAR));
  return { desplazamientoY: 0, angulo: 0, escalaX: 1 - silaba * 0.015, escalaY: 1 + silaba * 0.03 };
}

// ─── Gestos ──────────────────────────────────────────────────────────────────

/** Cuánto dura cada gesto del motor, en milisegundos. */
export const DURACION_DE_GESTO: Record<NombreDeGesto, number> = {
  saltar: 650,
  saludar: 900,
  asentir: 700,
  sorpresa: 600,
};

/** `progreso` va de 0 (empieza) a 1 (terminó). */
export function poseDeGesto(gesto: NombreDeGesto, progreso: number): Pose {
  switch (gesto) {
    case 'saltar':
      return poseDeSalto(progreso, 60);
    case 'sorpresa':
      return poseDeSorpresa(progreso);
    case 'saludar': {
      // Tres vaivenes que se apagan al final.
      const vaiven = Math.sin(progreso * Math.PI * 6) * (1 - progreso);
      return { ...POSE_NEUTRA, angulo: vaiven * 9 };
    }
    case 'asentir': {
      // Dos inclinaciones hacia abajo.
      const inclinacion = Math.abs(Math.sin(progreso * Math.PI * 2));
      return { ...POSE_NEUTRA, escalaY: 1 - inclinacion * 0.08, escalaX: 1 + inclinacion * 0.03 };
    }
  }
}

/**
 * Un salto en tres tiempos: se agacha, vuela (estirado) y cae (aplastado).
 */
function poseDeSalto(progreso: number, altura: number): Pose {
  const FIN_DE_AGACHARSE = 0.2;
  const FIN_DEL_VUELO = 0.8;

  if (progreso < FIN_DE_AGACHARSE) {
    const agachado = Math.sin((progreso / FIN_DE_AGACHARSE) * Math.PI);
    return { ...POSE_NEUTRA, escalaX: 1 + agachado * 0.1, escalaY: 1 - agachado * 0.14 };
  }
  if (progreso < FIN_DEL_VUELO) {
    const vuelo = (progreso - FIN_DE_AGACHARSE) / (FIN_DEL_VUELO - FIN_DE_AGACHARSE);
    const arco = Math.sin(vuelo * Math.PI); // 0 → 1 → 0
    return { ...POSE_NEUTRA, desplazamientoY: -altura * arco, escalaX: 1 - arco * 0.05, escalaY: 1 + arco * 0.08 };
  }
  const caida = Math.sin(((progreso - FIN_DEL_VUELO) / (1 - FIN_DEL_VUELO)) * Math.PI);
  return { ...POSE_NEUTRA, escalaX: 1 + caida * 0.08, escalaY: 1 - caida * 0.1 };
}

/** Sorpresa: un brinquito corto y se queda estirado un momento. */
function poseDeSorpresa(progreso: number): Pose {
  const salto = poseDeSalto(Math.min(1, progreso * 1.6), 22);
  const estiramiento = progreso > 0.6 ? Math.sin(((progreso - 0.6) / 0.4) * Math.PI) * 0.06 : 0;
  return combinarPoses(salto, { ...POSE_NEUTRA, escalaY: 1 + estiramiento });
}
