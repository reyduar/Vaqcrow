---
title: Todo o nada
type: concepto
sources:
  - como-funciona-vaqcrow.md
  - blog/vaqcrow-sobre-stellar.md
updated: 2026-10-16
---

# Todo o nada

Cada campaña fija una meta. La regla es **todo o nada** (All-or-Nothing): o se alcanza la meta, o cada aporte se puede reclamar.

La regla la aplica **el contrato**, no una persona. No hay margen para decidirla a mano.

## Los dos caminos

| Camino | Qué pasa |
|---|---|
| Meta alcanzada | Los fondos pasan al destino fijo de la PyME en la misma transacción en que se cruza la meta. Un pago ya liquidado no se puede revertir: no existe clawback. |
| Sin meta | Cada contribuyente puede reclamar su aporte. El reembolso es sin permisos. |

## Detalles que conviene no olvidar

- Al llegar a «Meta alcanzada», la interfaz deja de ofrecer el aporte y **el contrato rechaza** cualquier aporte nuevo: ese cierre lo aplica el contrato, no la pantalla.
- El tope que impide aportar más de lo que falta para la meta es otra regla: la aplica Vaqcrow antes de que se firme, no el contrato.
- El reembolso **no se dispara solo**: alguien tiene que enviar la transacción, y cualquiera puede hacerlo. El destino lo fija el contrato y no se puede redirigir.
- Los fondos que nadie reclame pueden quedarse en el contrato hasta el barrido.
