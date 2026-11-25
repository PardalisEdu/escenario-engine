# Guía de arte del Escenario Uno

Para que un dibujo nuevo no se vea «de prueba» junto a los demás, sigue estas reglas. Salen del logo de Pardalis.

## El estilo en cuatro reglas

1. **Contorno café grueso.** Color `#572d09` (la tinta del logo), 5 px en un personaje de ~200 px de alto,
   con uniones y puntas redondas (`stroke-linejoin="round"`, `stroke-linecap="round"`). Nunca negro.
2. **Colores planos y cálidos.** Sin degradados ni sombras difuminadas. Los detalles se hacen con una segunda
   forma plana (una mancha, un brillo blanco, una chapita rosa en la mejilla).
3. **Formas redondas y cabezonas.** Cabeza grande (casi la mitad del alto en los niños), cuerpo de pera, patas
   cortas. Ojos de óvalo café con un brillito blanco; chapitas; boca de dos curvitas, como en el logo.
4. **México a todo color.** Rosa mexicano, turquesa, naranja, morado, amarillo; grecas, bordados, talavera,
   papel picado. Cada personaje lleva algo que lo ubica: un rebozo, un sombrero de palma, un paliacate.

## Paleta

| Color | Código | Se usa en |
| --- | --- | --- |
| Tinta | `#572d09` | Todos los contornos |
| Amarillo Pardalis | `#fed449` (claro `#ffe27b`) | El pelaje de los ocelotes, acentos |
| Crema | `#fff6e0` | Hocicos, papel, fondos claros |
| Rosa nariz | `#f8b093` | Narices y chapitas (`#f58f6c` al 55 %) |
| Rosa mexicano | `#e8338b` (claro `#f7a1c4`) | Acentos, mantel, flores |
| Turquesa | `#17b5b0` (claro `#8fdcd6`) | Acentos, toldos, rebozo |
| Naranja | `#f58220` | Toldos, cempasúchil |
| Morado | `#7b3fa0` (oscuro `#5a2a80`) | Vestido de mamá, carpa de la vidente |
| Verde | `#3aa655` (claro `#9bd16b`) | Verduras, toldos |
| Rojo | `#e2452f` | Playera de Pardi, gorra de Bobby |
| Azul | `#2f6fd0` | Sudadera de Bobby, talavera |
| Madera | `#d99a5b`, `#b9783f`, `#8a5428` | Puestos, cajas, muebles |
| Cielo | `#bfe6f5` | El fondo de los telones: **es el color de fondo del motor**; si se cambia, se nota la costura |

## Medidas (100 píxeles = 1 metro)

| Qué | Tamaño del dibujo | Notas |
| --- | --- | --- |
| Personaje niño (Pardi, Bobby) | ~150 × 196 | Parado, con los pies al borde de abajo |
| Personaje adulto | ~170 × 250 | |
| Cosa del mercado (`item_…`) | 100 × 100 | Centrada; sirve en la lista, los minijuegos y los puestos |
| Fondo de puesto | 400 × 340 | Postes, toldo y estantes |
| Mostrador de puesto | 360 × 150 | La mesa: el vendedor queda entre el fondo y el mostrador |
| Telón de fachadas | 1480 × 620 | Con el cielo incluido |

## Reglas de los archivos (las exige el motor)

- **SVG con `viewBox`**, sin fuentes ni imágenes enlazadas.
- Los personajes **miran a la derecha**: el motor los voltea como un papel.
- El nombre del archivo es su clave. **No termines un nombre en `_número`** si no es un cuadro de animación:
  `moneda_5.svg` y `moneda_10.svg` se agruparían como la animación `moneda`. Por eso las monedas se llaman
  `item_moneda5`, `item_moneda10`.
- Una animación son archivos numerados del mismo tamaño: `tele_1.svg`, `tele_2.svg`. Su velocidad va en
  `assets.config.json`. El parpadeo de Pardi y de Bobby son seis cuadros: cinco iguales y uno con los ojos cerrados.
- Después de agregar, quitar o renombrar un dibujo: `bun run assets`.

## Cómo se arma un puesto en el mapa

En Tiled, un puesto son tres cosas en fila hacia la cámara, y así el vendedor queda **detrás** de su mostrador:

```
y = 150   el fondo      (decorado «parado», asset puesto_…)
y = 245   el vendedor   (capa npcs; está fuera del piso: no hace falta que se pueda caminar ahí)
y = 300   el mostrador  (decorado «parado», asset mostrador_…)
y ≥ 352   el piso por donde camina Pardi
```

Al tocar al vendedor, Pardi camina hasta la orilla del piso más cercana, que queda justo frente al mostrador.
