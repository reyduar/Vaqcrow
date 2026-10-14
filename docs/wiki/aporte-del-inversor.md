---
title: Aporte del inversor
type: flujo
sources:
  - freighter-and-testnet-walkthrough.md
  - como-funciona-vaqcrow.md
updated: 2026-10-14
---

# Aporte del inversor

Cómo un inversor entra, conecta su wallet y aporta a una campaña.

## Pasos

1. **Cuenta.** El inversor se registra en `/signup` con «Soy inversor», confirma su correo e ingresa en `/login`. Vaqcrow lo lleva a `/portfolio`.
2. **Wallet.** En `/portfolio`, con su cuenta activa en Freighter, presiona «Conectar Freighter» y firma un mensaje de verificación.
3. **Explorar.** En `/explore` aparece la campaña aprobada. «Ver evidencia y riesgo» abre el detalle en `/campaigns/[id]`.
4. **Aportar.** En el detalle escribe el monto y presiona «Aportar a la campaña».
5. **Verificación simulada.** La primera vez aparece la verificación de identidad del inversor: es simulada y se aprueba al continuar. No vuelve a pedirse.
6. **Firma.** Se abre la revisión antes de firmar: contrato de la bóveda, función `contribute`, custodia («El contrato de la bóveda, no una persona») y monto. El inversor presiona «Firmar en Freighter» y revisa en el popup la red, la cuenta activa, el contrato y el monto.

## Después de firmar

- El aporte muestra «Enviada · pendiente de confirmación» hasta que la cadena lo confirma. Enviada no es confirmada.
- Mientras la campaña siga en «Fondeo abierto», el inversor puede «Retirar mi aporte» desde `/portfolio`.
- Si la campaña vence sin alcanzar la meta, pasa a «Reembolso disponible» y el inversor puede «Reembolsar».
- El KYC del inversor es simulado y se aprueba automáticamente en el primer aporte; no hay aprobación manual de inversores.
