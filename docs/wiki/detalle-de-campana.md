---
title: Detalle de campaña
type: pantalla
screen: /campaigns/[id]
sources:
  - freighter-and-testnet-walkthrough.md
  - como-funciona-vaqcrow.md
updated: 2026-10-14
---

# Detalle de campaña (`/campaigns/[id]`)

Es la página de una campaña. Su detalle es **público y compartible por link**: se abre sin sesión.

## Qué muestra

- La evidencia y el riesgo, explicados en lenguaje llano, para que alguien sin expertise pueda evaluar antes de aportar.
- El `actor` de la decisión humana, como «Administración Vaqcrow».
- Una fila «Bóveda» con su link al explorador.
- El estado de la campaña, leído de la cadena: «Fondeo abierto», «Meta alcanzada» o «Reembolso disponible».

## Qué puede hacer el usuario acá

- Escribir un monto y presionar «Aportar a la campaña», que lleva a la revisión y a la firma en Freighter.

Si la cuenta no tiene wallet conectada, «Aportar a la campaña» manda a `/portfolio` para conectarla o crearla.
