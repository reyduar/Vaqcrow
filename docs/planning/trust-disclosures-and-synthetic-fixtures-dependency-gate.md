# Gate de dependencias — Avisos de confianza y fixtures sintéticos (Feature #17 / Task #53)

> Este documento es el registro auditable del gate compartido de skills/MCP exigido por el issue [#53](https://github.com/reyduar/Vaqcrow/issues/53) ("usar HeroUI... Tailwind CSS... y React Icons `io5`... Aplicar el gate compartido de skills/MCP antes de modificar dependencias") y por el diseño SDD de la Feature #17 (`sdd/feature-17-trust-disclosures/design`, obs #430, sección "Skill/MCP Discovery Gate Record"). Se commitea en su propio commit, **estrictamente antes** de cualquier commit que modifique `apps/web/package.json` o el lockfile: el orden de los commits en el historial de git es la prueba auditable de que esta búsqueda se hizo antes de la primera escritura de manifiesto/lockfile, no después.

## 1. Alcance de esta búsqueda

Antes de instalar HeroUI, Tailwind CSS o React Icons en `apps/web/package.json`, se buscó (a) skills instaladas que cubrieran la instalación/configuración de esas librerías para Next.js App Router, y (b) servidores MCP conectados a este repositorio que expusieran documentación o tooling aplicable a esas mismas librerías.

## 2. Skills buscadas

- **Registro del proyecto**: `docs/planning` no tiene un `## Skills to load before work` inyectado por el orquestador para esta fase, así que se aplicó el fallback documentado en `skills/_shared/sdd-phase-common.md` (sección A): leer `.atl/skill-registry.md` en la raíz del repositorio.
- **Archivo leído**: `.atl/skill-registry.md` (última actualización 2026-09-15), que indexa 16 skills provenientes de `.claude/skills` (proyecto) y de los directorios de skills de usuario (`~/.agents/skills`, `~/.claude/skills`, etc.).
- **Resultado**: ninguna skill indexada tiene un trigger aplicable a HeroUI, Tailwind CSS o React Icons. Las dos únicas skills de alcance `project` (`supabase`, `supabase-postgres-best-practices`) cubren exclusivamente Supabase/Postgres. El resto son skills de flujo SDD, git/PR, revisión y utilidades de proceso, sin relación con librerías de frontend.
- **Conclusión**: `none` — ninguna skill fue usada para esta instalación.

## 3. Servidores MCP inspeccionados

- **Archivo leído**: `.mcp.json` en la raíz del repositorio, que declara los servidores MCP conectados a este proyecto:
  - `stitch` (`https://stitch.googleapis.com/mcp`) — herramienta de diseño de UI de Google Stitch. Ya está referenciada en el issue #53 únicamente como **referencia visual** (`VaqcrowWebApp`, proyecto Stitch ID `5439082704079758723`), explícitamente no autoritativa para producción. No expone documentación de instalación de HeroUI, Tailwind CSS ni React Icons.
  - `supabase` (`https://mcp.supabase.com/mcp`) — base de datos/backend de Supabase. Sin relación con librerías de UI de frontend.
- Se revisaron también las instrucciones de servidores MCP inyectadas en el contexto de la sesión (`context7`, entre otras): aunque su descripción general menciona documentación de librerías de terceros, **no está declarado en `.mcp.json` de este proyecto** y no expuso ninguna herramienta invocable en esta sesión. No fue usado porque no está conectado a este repositorio.
- **Conclusión**: `none` de los servidores MCP conectados a este repositorio es aplicable a HeroUI, Tailwind CSS o React Icons.

## 4. Qué se usó en su lugar

Al no haber skill ni MCP aplicable, la instalación y configuración se resolvieron consultando directamente la documentación pública y actual de cada librería (vía `npm view` contra el registro de npm y lectura de la documentación oficial publicada por cada proyecto), verificando la versión mayor real que se instalaría antes de escribir cualquier paso de configuración — en particular porque HeroUI v3 (la versión estable actual, `@heroui/react@3.2.6`) cambió su arquitectura de instalación respecto de v2: ya no requiere un componente `<Provider>` envolvente, a diferencia de lo que asumía el diseño original. Esta verificación fue puramente de lectura (sin instalar nada aún) y se documenta con más detalle en la nota de progreso de Engram `sdd/feature-17-trust-disclosures/apply-phase1`, no en este documento, para no mezclar el registro del gate con hallazgos de diseño.

## 5. Declaración de no-crecimiento de alcance

Esta búsqueda no autorizó dependencias adicionales, configuración de servidores MCP nuevos, ni ningún crecimiento de alcance más allá de lo confirmado por el issue #53 y el diseño de la Feature #17: `@heroui/react`, `@heroui/styles` (paquete de estilos requerido por la instalación oficial actual de HeroUI v3, no listado explícitamente en la tarea 1.3 original pero necesario para que `@import "@heroui/styles"` resuelva), `react-icons`, `tailwindcss`, `@tailwindcss/postcss` y `postcss`, todos agregados únicamente a `apps/web/package.json`. El catálogo compartido `pnpm-workspace.yaml` permanece sin cambios, tal como lo exige la decisión de producto confirmada de que esta instalación es local a la app.
