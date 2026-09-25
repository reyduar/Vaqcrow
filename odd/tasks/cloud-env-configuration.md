# Cloud environment configuration — #286 + #287

## Objetivo

Que la configuración de la demo en la nube sea **reproducible desde el repositorio** y no
dependa de conocimiento que hoy vive sólo en la máquina del operador. Cierra la parte de
repo de dos issues de despliegue:

- [#286](https://github.com/reyduar/Vaqcrow/issues/286) — superficie Vercel (web).
- [#287](https://github.com/reyduar/Vaqcrow/issues/287) — configuración de la bóveda en la API hosteada.

## Problema

Tres defectos verificados el 2026-09-24, ninguno cosmetico:

1. **El nombre de la variable del backend web está mal en el documento.** El código lee
   `NEXT_PUBLIC_API_BASE_URL` (`apps/web/src`), pero `docs/architecture/deploy-planning.md`
   prescribe `NEXT_PUBLIC_API_URL` en **cuatro** lugares: el ejemplo de `vercel.json`
   (línea 325), la tabla de configuración del proyecto (línea 350) y los comandos CLI
   (líneas 1128 y 1131). Seguir el documento configura una variable que nadie lee, lo que
   reproduce exactamente el estado "no hay backend configurado" que el issue describe.

2. **El bloque `env` del `vercel.json` documentado es inválido.** Usa
   `"NEXT_PUBLIC_API_URL": "^NEXT_PUBLIC_API_URL"`. La documentación de Vercel sólo admite
   valores literales o referencias `@secret-name`; la interpolación `^VAR` no existe. El
   bloque, tal como está, setearía la variable al string literal `^NEXT_PUBLIC_API_URL`.
   La recomendación propia de Vercel es administrar las variables en Project Settings, que
   es justo lo que `deploy-planning.md` §7 ya declara como el mecanismo real.

3. **Los templates de entorno no nombran las claves del vault.** Ni `.env.cloud.example` ni
   `.env.docker.example` mencionan `STELLAR_CAMPAIGN_FACTORY_ID`,
   `STELLAR_PLATFORM_SECRET_KEY`, `STELLAR_TOKEN_CONTRACT_ID` ni `STELLAR_RPC_URL`. El
   bloque completo sólo vive en `.env.docker` —un archivo local, ignorado por git, de la
   red **local**—, así que la única forma de descubrir las claves era mirar un archivo que
   no sirve para la nube. `.env.docker.example` además arrastra un comentario obsoleto:
   afirma que el parser "sólo acepta testnet" y que conectar la API a la red local "está
   diferido a #237". #237 está cerrado y `generate-docker-env.sh` ya escribe el bloque local.

## Alcance

**Dentro:** los templates versionados `.env.cloud.example` y `.env.docker.example`; el nuevo
`vercel.json` en la raíz; `docs/architecture/deploy-planning.md` (§3 y §7); y
`docs/architecture/environments.md` (§7, §9, §11).

**Fuera:** tocar `.env.cloud` o `.env.docker` (ignorados por git, regla global de permisos
que además impide que un agente los lea); setear variables en Railway o Vercel; cambiar la
rama de producción en Vercel; comprar un dominio. Todo eso vive en #286/#287 y lo ejecuta la
persona operadora.

## Restricciones

- **Nunca escribir un valor secreto.** En los `.example` van sólo nombres de clave y
  placeholders (`<...>`). El valor de `STELLAR_PLATFORM_SECRET_KEY` no se transcribe nunca.
- **No tocar ni leer `.env.cloud` ni `.env.docker`.** Son de la persona operadora.
- **No inventar direcciones.** Usar únicamente las verificadas: fábrica Testnet
  `CDVSSQ55LBBYHAK5DNQG2UNPIG3PMPJELKJ7LKSNOBAIHAEHPMX75GXJ`, owner
  `GBCOTYYE3KGV745LQ4MELTP4IK2Z2RX2OESRNWP2LY6XLEI73X3PX2ZG` (identidad `vaqcrow-testnet`
  del keystore), API `https://api-production-c07f.up.railway.app`.
- Los documentos del repo están **en español**; `vercel.json` y los `.example` van en el
  registro que ya tienen (comentarios en inglés en los `.example`).
- Respetar la sintaxis Obsidian del repo en los `.md` (callouts `> [!info]` / `> [!warning]`,
  wikilinks `[[ruta|texto]]`).

## Checklist

- [x] **C1** — `.env.cloud.example`: agregar el bloque Stellar/Testnet del vault con
  `STELLAR_CAMPAIGN_FACTORY_ID`, `STELLAR_TOKEN_CONTRACT_ID` (opcional), `STELLAR_RPC_URL`
  (opcional) y `STELLAR_PLATFORM_SECRET_KEY`, con placeholders y un comentario que explique
  que la clave sale de la identidad `vaqcrow-testnet` del keystore (`stellar keys secret
  vaqcrow-testnet`) y que **las mismas claves deben setearse en el panel de Railway** para
  el despliegue. — `80fad22`
- [x] **C2** — `.env.docker.example`: corregir el comentario obsoleto sobre "el parser sólo
  acepta testnet" y "diferido a #237", y dejar claro que `generate-docker-env.sh` escribe el
  bloque de red local (`STELLAR_NETWORK=local`, RPC, fábrica, token, y la clave leída del
  keystore de la identidad `vaqcrow-platform`). — `80fad22`
- [x] **C3** — Crear `vercel.json` en la raíz del monorepo con `buildCommand`,
  `outputDirectory: apps/web/.next`, `installCommand`, `framework` y `regions`, **sin** el
  bloque `env` inválido. — `e8bf8f2`
- [x] **C4** — `deploy-planning.md`: corregir las cuatro ocurrencias de
  `NEXT_PUBLIC_API_URL` → `NEXT_PUBLIC_API_BASE_URL` (líneas 325, 350, 1128, 1131). — `e8bf8f2`
- [x] **C5** — `deploy-planning.md` §7: agregar `STELLAR_CAMPAIGN_FACTORY_ID` y
  `STELLAR_PLATFORM_SECRET_KEY` a la tabla "contrato real" de variables de la API, y al
  ejemplo de `railway variable set`. Marcar que la fábrica es pública y que la clave es un
  secreto que se setea en el panel, nunca en el repositorio. — `be63169`
- [x] **C6** — `environments.md` §9: corregir la afirmación de que la API no tiene consumidor
  Stellar en runtime. §11: documentar `vaqcrow-testnet` como la identidad de plataforma de
  Testnet, con la dirección pública verificada y el comando para obtener la clave. — `be63169`

## Verificación

- `node -e "JSON.parse(require('fs').readFileSync('vercel.json','utf8'))"` — el JSON parsea.
- `rg -n "NEXT_PUBLIC_API_URL"` sobre todo el repo **no devuelve resultados**.
- `rg -n "NEXT_PUBLIC_API_BASE_URL" docs/` devuelve las cuatro ocurrencias corregidas.
- Revisar que ningún `.env` que no sea `.example` haya sido modificado: `git status --short`
  no debe listar `.env.cloud` ni `.env.docker`.
- `pnpm run lint` y `pnpm run test:boundaries` verdes.
- Reportar el resultado observado de cada comando, y declarar explícitamente lo que no se
  pudo verificar.

## Estado

- [x] Relevamiento verificado (2026-09-24): tres defectos confirmados contra el código, la
  documentación de Vercel y la red de Testnet.
- [x] C1–C6 ejecutados en la rama
  `Vaqcrow#286_Task_Restore_the_Vercel_production_deployment_and_its_configuration`:
  `e8bf8f2` (C3+C4), `be63169` (C5+C6), `80fad22` (C1+C2).
- [x] Verificación re-ejecutada por el padre, no aceptada del reporte del writer:
  `vercel.json` parsea; **cero** `NEXT_PUBLIC_API_URL` en archivos versionados;
  `git status --short` no lista `.env.cloud` ni `.env.docker`; ningún valor con forma de
  secret key en los `.example`.
- [ ] Fuera de esta rama: PR sin abrir, rama sin pushear. La rama de producción de Vercel,
  las variables de panel y el secreto de Railway siguen en manos de la persona operadora.

### Desvíos del plan

- Los commits salieron en orden distinto al sugerido: `deploy-planning.md` mezclaba C4 y C5
  en un mismo hunk, así que el commit de Vercel quedó primero. El agrupamiento por contenido
  se mantiene.
- El plan atribuía a `environments.md` §9 la frase "la API no tiene consumidor Stellar en
  runtime". Esa frase literal estaba en `.env.docker.example`; §9 decía algo más débil. El
  defecto era real y el writer corrigió **ambas**: el comentario del template y §9.
- La verificación "el grep de `NEXT_PUBLIC_API_URL` no devuelve resultados" **no puede ser
  vacía a nivel repo** mientras este mismo archivo esté versionado, porque cita el token
  incorrecto para describir el defecto. Por eso la verificación se acotó a archivos
  versionados (`git grep`), y §3 del documento explica el bloque removido como
  `"<VAR>": "^<VAR>"` en vez de reimprimir el token exacto.
- `pnpm run lint` fue un cache hit de Turbo y no re-linteó nada: sólo se tocaron docs y
  config, que no son inputs de lint. `pnpm run test:boundaries` sí pasó 79/79 real.
- Se tildó `Crear vercel.json en la raíz` en el checklist de readiness de
  `deploy-planning.md` §8, que ahora es verdad.

## Notas

- `deploy-planning.md` §7 ya tiene una sección `> [!danger] Corrección del contrato de
  variables (2026-09-22)`. La tabla nueva debe seguir ese patrón: nombrar la variable, si es
  obligatoria y una nota. Extenderla, no duplicarla.
- La fábrica de Testnet y su owner están verificados por lectura contra la red (ver issue
  #287, comentario del 2026-09-24). El `vault_wasm` que la fábrica reporta coincide con el
  build de `main`, y el Rust no cambió desde el deploy del 23/09.
- Pendiente de decisión de la persona operadora, fuera de este alcance: rama de producción
  de Vercel, `NEXT_PUBLIC_API_BASE_URL` en el panel, el secreto en Railway, dominio propio y
  política de SSO en previews.
