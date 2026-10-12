# Bitácora — Especificación OpenAPI y Swagger UI publicada

## Objetivo

Cerrar la Feature foundation [#487](https://github.com/reyduar/Vaqcrow/issues/487): documentar toda la superficie HTTP de `apps/api` en una **OpenAPI 3.1** renderizada con **Swagger UI** en una URL pública, linkeada desde el README.

## Por qué

La API tenía 62 rutas registradas y cero documentación de contrato. El owner pidió documentar todo lo hecho en la API con Swagger y publicar el link en el README.

## Rama

- **Rama:** `Vaqcrow#487_Foundation_Publish_an_OpenAPI_Swagger_spec_for_the_API_linked_from_the_README` (off `main`).

## Decisiones del owner (2026-10-12)

- **Hosting:** GitHub Pages estático (no `/docs` servido por la API).
- **Rutas ADMIN/AUTHENTICATED:** se documentan en el sitio público, marcadas por el rol requerido.
- **Autoría/sync:** derivar de los contratos Zod (recomendación del issue, no objetada).

## Diseño

El spec es **generado** desde dos fuentes verificables por tests, no escrito a mano ruta por ruta:

1. **Inventario de rutas** — `ROUTE_POLICY_KEYS` / `resolveRoutePolicy` (`apps/api/src/application/authorization/route-policy.ts`): el spec no puede omitir una ruta de la tabla de autorización, y el `security` de cada operación se **deriva de la misma policy que aplica el hook HTTP** (nunca se copia a mano).
2. **Contratos Zod compartidos** — cada cuerpo de request/response referencia el contrato real de `@vaqcrow/contracts` y se convierte con **`z.toJSONSchema()` de Zod v4** (no hizo falta ninguna dependencia de OpenAPI ni un puente zod→JSON-Schema). Un cambio de contrato se refleja en el spec y, si el `openapi.json` commiteado no se regenera, el test de drift falla.

Donde un handler valida o arma el cuerpo **inline** (sin contrato compartido), la operación documenta el cuerpo como un objeto libre con una nota, en vez de inventar un esquema.

## Unidad de trabajo

- [x] **U1 — Generador + registro + test.** `apps/api/src/infrastructure/http/openapi/`: `route-registry.ts` (metadatos por ruta, clave = la de la tabla de autorización), `build-openapi.ts` (arma el documento 3.1), `generate-openapi-cli.ts` (escribe `apps/api/openapi.json`), `openapi.test.ts`. Script `openapi:generate` en `apps/api`. Se agregó `zod` como devDependency explícita de `apps/api` (el linker aislado no la exponía; el generador es un concern de la API) y se actualizó el lockfile.
- [x] **U2 — Publicación + README.** `.github/pages/swagger/index.html` (Swagger UI), `.github/pages/index.html` (ahora linkea Storybook y API), paso nuevo en `.github/workflows/storybook.yml` que stagea `/swagger/` junto al Storybook en el mismo artefacto de Pages, y sección nueva en `README.md` con el link.

## Verificación

- `openapi.test.ts` (5 tests): el registro cubre **exactamente** `ROUTE_POLICY_KEYS` (sin faltantes ni extras), toda ruta queda documentada, el `security` coincide con la policy, hay un security scheme `bearerAuth`, y el `openapi.json` commiteado está **en sync** con el generador.
- Generado: **53 paths**, **14 tags**, `openapi: 3.1.0`, esquemas derivados de los contratos. `openapi.json` es un artefacto commiteado (334 KB).
- `pnpm run verify` → **EXIT 0**, tareas 5/8/8/5 verdes (los «2 problems» de lint son los dos warnings preexistentes de `admin-users.test.tsx`, 0 errores).
- El test de gates de CI (`tests/testing-and-ci-gates.test.ts`) sólo inspecciona `ci.yml`, así que el cambio en `storybook.yml` no lo afecta.

## Tradeoff y follow-ups

- **Swagger UI por CDN (unpkg).** La página estática carga los assets de Swagger UI desde unpkg: es una dependencia de **runtime del navegador de esa página publicada**, no del CI (el job sólo copia archivos). Si se quiere autosuficiente, un follow-up puede vendorizar `swagger-ui-dist` y copiarlo al artefacto.
- **`openapi.json` grande (334 KB)** por inlinear los esquemas (`reused: "inline"`). Un follow-up puede emitir `components.schemas` con `$ref` para achicarlo y hacerlo más revisable.
- **Cobertura de esquemas:** cubre los cuerpos/response con contrato compartido; los cuerpos validados inline quedan descriptos, no esquematizados.
