# Bitácora — Congelamiento del build y la presentación (Feature #34)

> Rama: `Vaqcrow#34_Feat_Freeze_build_and_presentation_materials`, creada desde `main` `534f295` y **apilada sobre la rama de #33** (su contenido está presente en esta rama, todavía no en `main`).
> Evidencia de cierre: [[docs/planning/final-build-and-presentation-freeze-evidence|Evidencia de cierre de la Feature #34]].
> Unidad: **sólo documentación**. No se tocó código de producto, tests, migraciones ni configuración.

## Qué produce esta unidad

Dos documentos nuevos, dentro de la superficie permitida:

- `docs/planning/final-build-and-presentation-freeze-evidence.md` — el cierre de Feature #34 (#107/#108/#109): candidato y tag, narrativa de presentación por rol, disclaimers exactos, índice del paquete de evidencia (47 documentos), artefactos de respaldo, decisiones de producción abiertas, límites honestos y el mapeo de criterios verbatim.
- `odd/tasks/final-build-and-presentation-freeze.md` — esta bitácora.

No hay commit de producción propio: es una Feature documental. Su verificación es la **readback** del corpus y de este árbol de trabajo, no una corrida nueva.

## El candidato congelado y el tag

- **Candidato:** el `main` HEAD resultante de mergear la PR #474 (Feature #33) y esta unidad (Feature #34).
- **Tag:** `v1.0.0`, el primero del repositorio, colocado por el **owner** sobre ese `main` HEAD.
- **No se nombra un SHA**: no existe hasta el merge.
- **Un tag es un puntero, no un artefacto** — no empaqueta, no compila, no publica.

Al escribir esto **no existe ningún tag** (`git tag -l` vacío) y el candidato no está en `main`. Se describe el congelamiento; el merge y el tag los ejecuta el owner.

## Límites honestos

1. El paquete de respaldo de #33 sigue incompleto: **video, capturas, XDR decodificado y JSON de IA pendientes** (pasos del operador).
2. El e2e en vivo **no se observó en verde** (stack local degradado: timeouts de Supabase Auth, `503 unavailable`, `supabase_pg_meta_vaqcrow unhealthy`); su historial verde se cita.
3. El suite `@vaqcrow/web` es sensible a la carga (timeout de 5 s); los archivos afectados pasan aislados.
4. El **reset de Testnet del 2026-12-16** invalida las direcciones de contrato: la fábrica se redespliega y `STELLAR_CAMPAIGN_FACTORY_ID` se re-apunta.
5. El conteo verificado del corpus es **47** `*-evidence.md` pre-existentes (**48** con este documento); la unidad padre mencionaba 46. El índice de §6 usa la cifra verificada.

## Próximo paso

Mergear PR #474 (#33) y la PR de #34 a `main`; recién entonces colocar el tag `v1.0.0` y nombrar el commit resultante. Después, producir los artefactos de respaldo que #33 dejó pendientes (video, capturas, JSON de IA) y re-ejecutar el e2e U9 en un stack local sano.
