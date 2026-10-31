// Host de ejemplo: hace lo que haría montar.ts en Astro (§13), sin Astro.
import { EscenarioEngine, type MiniGameFactory } from '../src/index';

const CLAVE = 'pardalis:aventura:tortilleria:save';

// Minijuego de ejemplo: tocar las tres tortillas. Sin vidas ni mensajes de error.
const Tortilleria: MiniGameFactory = ({ scene }) => new Promise((res) => {
  const { width, height } = scene.scale;
  scene.add.rectangle(width / 2, height / 2, width, height, 0xfff3d6);
  let faltan = 3;
  for (let i = 0; i < 3; i++) {
    const t = scene.add.circle(width / 2 + (i - 1) * 220, height / 2, 80, 0xf2d27a).setStrokeStyle(6, 0xc69a3a).setInteractive();
    t.once('pointerdown', () => {
      scene.tweens.add({ targets: t, scale: 0, duration: 250 });
      if (--faltan === 0) scene.time.delayedCall(400, () => res({ exito: true, otorgar: { tortillas: true } }));
    });
  }
  // «Salir» siempre es amable: regresa con exito false y el motor toma siNo.
  scene.add.text(width - 20, 20, '✖', { fontSize: 48 }).setOrigin(1, 0).setInteractive().once('pointerdown', () => res({ exito: false }));
});

const respuesta = await fetch('/niveles/tortilleria.json');
if (!respuesta.ok) throw new Error(`No se pudo cargar el nivel (${respuesta.status})`);
const config = await respuesta.json();
const juego = new EscenarioEngine({
  mapa: '/niveles/tortilleria.tmj',
  config,
  assetsRoot: '/assets/',
  minigames: { Tortilleria },
  save: localStorage.getItem(CLAVE),
  i18n: { base: 'es' },
  debug: new URLSearchParams(location.search).has('debug'),
});
const guardar = () => localStorage.setItem(CLAVE, JSON.stringify(juego.serialize()));
const estado = document.querySelector('#estado')!;
juego.on('objetivoCompleto', (id) => { estado.textContent = `✔ ${id}`; guardar(); });
juego.on('palabra', (p) => console.log('álbum:', p));
juego.on('escenaTerminada', (destino) => { guardar(); estado.textContent = `escenaTerminada → ${destino}`; });
juego.on('error', (e) => { estado.textContent = `error: ${e.message.split('\n')[0]}`; });
juego.mount('#contenedor');
const alSalirDeLaPagina = () => { guardar(); juego.destroy(); };
addEventListener('pagehide', alSalirDeLaPagina);

let proyeccion = false;
document.querySelector('#proyeccion')!.addEventListener('click', () => juego.setProyeccion((proyeccion = !proyeccion)));
// Sin quitar el oyente de pagehide, la recarga volvería a guardar la partida recién borrada.
document.querySelector('#reiniciar')!.addEventListener('click', () => {
  removeEventListener('pagehide', alSalirDeLaPagina);
  localStorage.removeItem(CLAVE);
  location.reload();
});
(globalThis as any).juego = juego;
