---
title: Cómo funciona Vaqcrow — el recorrido completo de una campaña
tags:
  - demo
  - producto
  - stellar
  - testnet
  - guide
date: 2026-10-13
status: draft
---

# Cómo funciona Vaqcrow

Vaqcrow conecta a una PyME que necesita capital con inversores que aportan dinero de prueba en **Stellar Testnet**. La plataforma no presta ni invierte por su cuenta: ordena la evidencia, calcula lo que corresponde y deja que las personas firmen. Este documento recorre la operación completa, paso por paso, y aclara en cada tramo qué es real y qué es simulado en la demo.

**Dónde encaja Vaqcrow.** El financiamiento colectivo empezó como *crowdfunding*: muchos aportan a cambio de una recompensa simbólica. El *crowdequity* abrió algo más fuerte —que cualquier persona con criterio para evaluar un negocio pueda invertir en él, muchas veces más por el proyecto que por el interés económico— pero lo hace entregando **acciones**. El *crowdlending* llevó esa misma apertura a empresas ya constituidas, con un préstamo. Vaqcrow es un camino distinto y en parte híbrido: la PyME recibe capital y lo devuelve con un **porcentaje de sus ventas mensuales** (revenue share), no con acciones ni con una cuota fija. Esa diferencia es el corazón del recorrido que sigue.

## La PyME crea su cuenta

La PyME se registra con su email y una contraseña, y confirma su correo. En la demo, el KYC es simulado: no se verifica una identidad real contra ningún registro. Lo que sí es real es la cuenta, su rol `PYME` y la sesión.

## Registra la PyME y sube los documentos

Un asistente pide los datos del negocio y hasta tres documentos obligatorios —declaraciones de ventas, constancia de CUIT y estatuto— más hasta cuatro fotos opcionales. Los archivos **se suben de verdad** a un espacio privado, separado por dueño; nadie más los ve. Al terminar, la PyME envía su solicitud a revisión.

## La IA evalúa los documentos

La inteligencia artificial hace dos cosas y solo dos: revisa que no falte nada y estima si cada documento parece pertinente a lo que dice ser. Marca faltantes y anomalías y deja su evaluación a la vista. **No aprueba, no decide y no calcula cuánto le corresponde a nadie**: eso queda para las personas y para el contrato.

## La PyME conecta Freighter

La PyME conecta su wallet **Freighter**. Vaqcrow guarda únicamente la clave **pública**, que será el destino inmutable de los fondos. La clave privada nunca sale de la wallet y la plataforma no la pide: Vaqcrow no custodia.

## Una persona aprueba

Una administradora o administrador revisa la solicitud completa —datos, documentos, la evaluación de la IA y la clave pública— y decide. La decisión queda registrada con **nombre, razón y fecha**, e incluye el límite aprobado. Acá no hay aprobación automática.

## La bóveda se despliega en Testnet

Al aprobar, se despliega una **bóveda**: un contrato en Stellar (Soroban), uno por campaña. El contrato es el único que puede mover los aportes, y solo puede pagarlos al destino fijo definido al abrirlo. Durante la campaña, **nadie tiene una clave para moverlos** —ni la PyME, ni el inversor, ni Vaqcrow—.

## La campaña se publica

La campaña se publica para inversores. Su detalle es **público y compartible por link**, con la evidencia y el riesgo a la vista y explicados en lenguaje llano, para que alguien sin expertise pueda evaluar antes de aportar.

## El inversor entra y conecta su wallet

El inversor crea su cuenta y confirma su correo. En la demo, su KYC también es simulado y se aprueba automáticamente en el primer aporte; no hay una aprobación manual de inversores. Después conecta Freighter, igual que la PyME.

## El inversor aporta

El aporte viaja a la bóveda y el inversor lo firma en su wallet. Mientras la campaña siga abierta, puede **retirar su aporte** si cambia de idea. Los aportes de todos quedan registrados contra la campaña.

## La meta: todo o nada

Cada campaña fija una meta, y la regla es **todo o nada** (All-or-Nothing). La aplica el contrato, no una persona: no hay margen para decidirla a mano. El resultado es uno de los dos caminos que siguen.

## Meta alcanzada: la PyME recibe el capital

La liquidación ocurre en la misma transacción en que se alcanza la meta: los fondos pasan al destino fijo de la PyME. Una vez liquidado, **un pago no se puede revertir**: no existe clawback.

## Sin meta: reembolso a los contribuyentes

El reembolso **no se dispara solo**: alguien tiene que enviar la transacción, y cualquiera puede hacerlo. Los fondos que nadie reclame pueden quedarse en el contrato hasta el barrido.

## La distribución mensual del revenue share

Una vez que la PyME tiene el capital, devuelve a los inversores una parte de lo que vende. Cada mes la PyME declara sus ventas —en la demo, esas ventas son sintéticas—; el sistema calcula con una **regla versionada** (`RS-2026-01`, en la demo el 4,5 %) y reparte entre los inversores **en proporción a lo que aportó cada uno**. El cálculo es determinístico y la IA no participa. La PyME **firma la transacción en Freighter**; Vaqcrow no la firma ni mueve los fondos. Si la PyME vende menos, se distribuye menos: no hay una cuota fija que se deba pagar igual.
