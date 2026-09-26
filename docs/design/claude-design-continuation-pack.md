# Vaqcrow — Pack de continuación para Claude Design

> **Qué es.** El complemento de [`claude-design-brief.md`](./claude-design-brief.md) para **cerrar las
> pantallas que faltan** en el template generado. Contiene el hueco exacto con evidencia, las
> convenciones reales que siguen las 15 piezas existentes, y un prompt listo para pegar por pantalla.
> Se usa **junto** al brief: el prompt maestro de §10.1 más el bloque de pantalla de §4 de este pack.

> [!warning] Por qué es un pack de prompts y no las pantallas escritas
> Claude Design no se puede manejar desde el entorno de este repositorio, y las piezas existentes son
> markup generado de 30–60 KB con estilos inline y un script `DCLogic` por pantalla. Escribirlas a mano
> daría archivos que **no se pueden renderizar ni verificar acá** y que divergirían del generador. Este
> pack es el camino verificable: es texto, se puede chequear contra el brief y contra las piezas reales,
> y vuelve directo a la herramienta que las creó.

---

## 1. Qué existe hoy

15 piezas en `docs/design/template/` (25 MB, sin versionar), **una por pantalla y con ambos temas en el
mismo archivo**:

| Pieza | Flujo(s) | Estado |
|---|---|---|
| `Vaqcrow Sistema.dc.html` | — (sistema de diseño) | ✅ Completa |
| `Vaqcrow Landing.dc.html` | 3 Landing | ✅ (con 2 duplicados) |
| `Vaqcrow Onboarding.dc.html` | 1 Onboarding | ✅ |
| `Vaqcrow Onboarding PyME.dc.html` | 2 Onboarding PyME: KYC | ✅ |
| `Vaqcrow Explorar PyMEs.dc.html` | 4 Marketplace | ⚠️ Filtros sólo mencionados |
| `Vaqcrow Detalle PyME.dc.html` | 7 Detalle de PyME | ✅ |
| `Vaqcrow Portafolio.dc.html` | 9 Portafolio | ✅ |
| `Vaqcrow Informes.dc.html` | 11 Informes | ✅ |
| `Vaqcrow Ayuda.dc.html` | 13 Centro de ayuda | ✅ |
| `Vaqcrow Guia de inversion.dc.html` | 14 Guía de inversión | ✅ |
| `Vaqcrow Guia emprendedores.dc.html` | 15 Guía para emprendedores | ✅ |
| `Vaqcrow Acerca de.dc.html` | 19 Acerca de Vaqcrow | ✅ |
| `Vaqcrow Admin.dc.html` | 16 / 17 / 18 Admin | ⚠️ Una pantalla para tres flujos |

## 2. El hueco exacto

| # | Flujo | Pantalla | Prioridad | Por qué |
|---:|---|---|---|---|
| 10 | **Billetera** | ❌ No existe | **1 — crítica** | Es donde viven la custodia por contrato, la firma y el reembolso: el corazón de la demo |
| 6 | **Registro de PyME** | ❌ No existe | 2 | Es la ruta implementada `/request`; sin ella el recorrido no se entiende |
| 8 | **Tokenización de PyME** | ❌ No existe | 3 | Explica el financiamiento, el % de revenue share y el destino inmutable |
| 12 | **Notificaciones** | ❌ No existe | 4 | Sólo aparece como enlace en `Admin` |
| 5 | **Marketplace con filtros** | ⚠️ Mencionada | 5 | `Explorar PyMEs` nombra "Filtro" y "Riesgo", pero no tiene sector/monto/plazo |
| 16-18 | **Admin ×3** | ⚠️ Una sola | 6 | Hay que partirla en Gestión de PyMEs / Revisión de solicitud / Usuarios |

> [!note] Evidencia del hueco
> `grep -il "Filtro\|Sector\|Monto\|Plazo"` sobre `Explorar PyMEs` da Filtro=2, Riesgo=2, Sector=0,
> Monto=0, Plazo=0. `grep -c "Gestión de PyMEs"` sobre `Admin` da 0. La nav de las piezas existentes
> enlaza `Explorar PyMEs`, `Portafolio`, `Informes` y `Ayuda` — **no enlaza `Billetera`**, coherente con
> la pantalla faltante.

## 3. Convenciones que las pantallas nuevas deben respetar

Para que el resultado sea indistinguible del set actual, cada pantalla nueva se genera **a partir de la
pieza hermana más parecida**, no desde cero:

| Pantalla nueva | Derivar de |
|---|---|
| Billetera y fondeo | `Vaqcrow Portafolio.dc.html` |
| Registro de PyME | `Vaqcrow Onboarding PyME.dc.html` |
| Tokenización | `Vaqcrow Detalle PyME.dc.html` |
| Notificaciones | `Vaqcrow Admin.dc.html` |
| Filtros avanzados | `Vaqcrow Explorar PyMEs.dc.html` |
| Admin ×3 | `Vaqcrow Admin.dc.html` |

**Lo que hay que reutilizar sin tocar:**

- **Runtime:** `<script src="./support.js">` y la raíz `<x-dc>` con `<helmet>`. El runtime
  (`dc-runtime`) es generado: no editarlo.
- **Documento:** un solo archivo por pantalla con **los dos temas** definidos (`:root,[data-theme="light"]`
  y `[data-theme="dark"]`).
- **Tokens:** el bloque `<style>` de la pieza hermana, sin cambios. Colores de marca `#8A05BE`,
  canvas/surface/texto claro y oscuro ya están resueltos ahí.
- **Tipografía:** Geist + Geist Mono vía Google Fonts, con cifras tabulares en montos.
- **Iconos:** Ionicons 7.4 por Web Component (`<ion-icon name="…">`), combinados con texto y con
  `aria-hidden` cuando son decorativos.
- **Shell:** `<header>` sticky con el isotipo (`assets/vaqcrow-isotipo.png` como máscara), wordmark,
  `<nav aria-label="Principal">` y `aria-current="page"` en la pantalla activa; `<footer>` con el aviso
  de `No apto para producción`. Los enlaces entre piezas son **por nombre de archivo**
  (`Vaqcrow X.dc.html`).
- **Script:** `class Component extends DCLogic` con `state` y `componentDidMount`. Reutilizar el
  andamiaje de sesión y tema de la hermana: `authMount()`/`authUnmount()`, persistencia en
  `vaqcrow-theme` y `vaqcrow-session`, `setTheme()`, `themeOptions`, cierre de menú con `Escape`.
- **Directivas:** `<sc-if value="{{ expr }}">` y `<sc-for list="{{ arr }}" as="x">`, interpolación con
  `{{ expr }}`. Los estilos interactivos usan `style-hover="…"`.
- **Estados demostrables:** exponerlos como **props** en `data-props` del bloque
  `<script type="text/x-dc">` (patrón de la hermana), para poder mostrar cada estado sin backend.

> [!important] Al agregar `Billetera` hay que sumarla a la nav del shell
> Hoy la navegación primaria de todas las piezas omite `Billetera`. Al crear la pantalla, sumar el
> enlace en el `<nav>` de **todas** las piezas para que la nav quede coherente con el brief (§4 de
> `claude-design-brief.md`).

---

## 4. Prompts por pantalla

Cada bloque se concatena con el **prompt maestro** de
[`claude-design-brief.md`](./claude-design-brief.md) §10.1. Generar `DESKTOP` y `MOBILE` para `LIGHT` y
`DARK`.

### 4.1 Billetera y fondeo — flujo 10 · prioridad 1

```text
SCREEN 10 — Billetera y fondeo por bóveda de campaña
Derive from: the existing "Vaqcrow Portafolio.dc.html" piece — reuse its runtime, its <style> token
block, its Geist fonts, its Ionicons, and its full header/nav/footer shell unchanged. Add "Billetera"
to the primary nav. One file with both themes.
Route: /funding (nav label: Billetera)
Actor: investor (contributes, withdraws, refunds) and SME (opens the vault, declares goal and deadline).

Purpose: let the SME open the campaign vault, and let the investor connect Freighter, review the
contract invocation and sign it without custody — while making the custody model unmistakable.

Key content:
- Vault state badge read from the chain: "Fondeo abierto" / "Meta alcanzada" / "Reembolso disponible".
- Vault summary as label + value: Meta (XLM), Total aportado, Fecha límite, Tu aporte. Large tabular
  numerals, right-aligned.
- Open-vault panel (SME, when no campaign exists yet): goal in XLM, deadline date, and the explicit
  note that the SME signs nothing here — the platform opens the vault on the account they declared.
- Invocation review before signing: network, signing account, vault contract address, asset, amount —
  and the explicit note that the settlement destination is fixed by the contract when the vault opens
  and is immutable, so the person does not choose it.
- Contribution form: amount in XLM with precision guidance and Testnet balance.
- Own-contribution controls: "Aportar", "Retirar mi aporte" while the campaign is open, and
  "Reembolsar" once the deadline passes without the goal. Next to the refund target field, the exact
  note: leaving it empty refunds your own contribution, the destination is fixed by the contract, and
  triggering another account's refund cannot redirect its funds — only fire it.
- Link to the contract in the Testnet explorer when the vault exists.
- Full disclosure banners in Spanish: "Custodia por contrato", "Firma no custodial" and "Stellar
  Testnet"; plus the microcopy "Activo de prueba sin valor económico" near the amount and "Verifica
  cuenta, red, el contrato de la bóveda, el activo y el monto en Freighter" before signing.

Critical states (expose each as a data-props toggle):
- vaultState: funding | settled | refunding
- wallet: absent | connecting | connected | wrongNetwork | rejected
- operation: idle | signing | submitted | error
- contribute form: empty | invalid | exceedsLimit | overGoal | closed

Boundaries: no guaranteed return, no probability of success, no production claim, no real money. A
submitted transaction must never look confirmed — use neutral tone and text plus icon, never a success
checkmark or green celebration. During the campaign the contributions are held by the contract; no
person holds a key to them. There is no recovery and no clawback. The deadline refund is permissionless
but never self-firing.
TARGET_DEVICE: DESKTOP|MOBILE · TARGET_THEME: LIGHT|DARK
```

### 4.2 Registro de PyME — flujo 6 · prioridad 2

```text
SCREEN 6 — Registro de PyME (solicitud y evidencia)
Derive from: the existing "Vaqcrow Onboarding PyME.dc.html" piece — same runtime, tokens, fonts, icons
and shell. One file with both themes.
Route: /request (nav label: Mi PyME)
Actor: SME.

Purpose: send the financing request with synthetic evidence, and make it obvious at every step which
data is simulated.

Key content:
- Business profile: legal name, sector, location, and testimonial/synthetic origin.
- KYC/KYB block with its simulated status and the contiguous badge "SIMULADO".
- Monthly sales table, accessible (<table> with scope headers) with amount, source, and status — and an
  explicitly missing period ("abril está ausente") plus one flagged anomaly ("junio requiere revisión")
  rendered as status chips that never rely on colour alone.
- Evidence panel: source, reference, extract, provenance, each with "SIMULADO".
- Explicit submission confirmation and a visible summary of what was sent.

Critical states (data-props): empty | partially complete | invalid | submitting | submitted | error.

Boundaries: synthetic data only. Required microcopy verbatim: "Resultado simulado para esta demo; no
constituye una verificación de identidad" and "Serie sintética y reproducible; abril está ausente y
junio contiene una anomalía intencional". Never use the phrase "KYC verificado" without context.
TARGET_DEVICE: DESKTOP|MOBILE · TARGET_THEME: LIGHT|DARK
```

### 4.3 Tokenización de PyME — flujo 8 · prioridad 3

```text
SCREEN 8 — Tokenización de PyME
Derive from: the existing "Vaqcrow Detalle PyME.dc.html" piece — same runtime, tokens, fonts, icons and
shell. One file with both themes.
Route: /marketplace/[pymeId]/tokenizacion
Actor: SME / operator.

Purpose: define and show the campaign financing — the numbers a person is actually committing to.

Key content:
- Goal (XLM), deadline, revenue-share percentage, minimum unit, and the versioned rule that produces the
  obligation.
- The settlement destination, stated as fixed by the contract and immutable once the vault exists, with
  the contract link in the Testnet explorer and its address in a copyable, wrap-safe block.
- A breakdown of what the investor receives and what the SME commits, as label + value pairs.
- An explicit "qué no garantiza esta campaña" panel.

Critical states (data-props): draft | published | goalReached | refunding.

Boundaries: never present the revenue share as a guaranteed return and never show a probability of
success. The 4,50 % is a contractual revenue-share rate, not a return. Label simulated figures.
TARGET_DEVICE: DESKTOP|MOBILE · TARGET_THEME: LIGHT|DARK
```

### 4.4 Notificaciones — flujo 12 · prioridad 4

```text
SCREEN 12 — Notificaciones
Derive from: the existing "Vaqcrow Admin.dc.html" piece — same runtime, tokens, fonts, icons and shell.
One file with both themes.
Route: /notificaciones
Actor: any authenticated user.

Purpose: review status notices, changes and confirmations without hunting for them.

Key content:
- Grouped by date, most recent first.
- Each item: type, title, one-line body, timestamp, and the link to the object it refers to.
- Read/unread state perceivable WITHOUT relying on colour (weight, dot plus text label, or an explicit
  "Sin leer" chip).
- Useful empty state that explains what will appear here.

Critical states (data-props): loading | empty | unread present | all read | error.
TARGET_DEVICE: DESKTOP|MOBILE · TARGET_THEME: LIGHT|DARK
```

### 4.5 Marketplace con filtros avanzados — flujo 5 · prioridad 5

```text
SCREEN 5 — Marketplace con filtros avanzados
Derive from: the existing "Vaqcrow Explorar PyMEs.dc.html" piece — same runtime, tokens, fonts, icons
and shell. One file with both themes. This is a mode of the same route, not a new page.
Route: /marketplace (advanced filters mode)
Actor: investor.

Purpose: narrow opportunities by sector, risk, amount and term.

Key content:
- Filter panel: sector, risk band (Bajo / Medio / Alto as TEXT plus icon, never a decorative gauge),
  amount range and term.
- Active filter chips, each removable, plus a "Limpiar filtros" action and a live result counter.
- Result cards keep the same anatomy as Explorar PyMEs, each with its contiguous "SIMULADO" badge.
- Empty state that suggests relaxing a filter instead of dead-ending.

Critical states (data-props): loading | results | noResults | error.
Boundaries: no expected return and no marketplace performance metrics.
TARGET_DEVICE: DESKTOP|MOBILE · TARGET_THEME: LIGHT|DARK
```

### 4.6 Admin en tres pantallas — flujos 16, 17 y 18 · prioridad 6

```text
SCREEN 16/17/18 — Admin, split into three views
Derive from: the existing "Vaqcrow Admin.dc.html" piece — same runtime, tokens, fonts, icons and shell.
Produce THREE separate files, each with both themes, sharing the admin sub-navigation
("Gestión de PyMEs", "Solicitudes", "Usuarios") with aria-current on the active one.
Routes: /admin/pymes · /admin/solicitudes/[solicitudId] · /admin/usuarios
Actor: operator.

16 — Gestión de PyMEs: table of registered SMEs with status, sector, last change and last actor; row
actions with explicit confirmation; denser than the public product.
17 — Revisión de solicitud: the structured AI assessment (risk band, confidence, reasons, anomalies,
missing items, open questions) clearly SEPARATED from the human decision panel (actor, reason, limit,
timestamp), where the human decision carries the weight and is always attributed.
18 — Usuarios: users with role and status, invitation, role change with explicit confirmation, and a
visible audit trail of who changed what.

Critical states (data-props) for 17: processing | valid | invalid | timeout | fallback | requiresChanges
| approved | rejected. For 16 and 18: loading | empty | error | actionInProgress.

Boundaries: never show "Aprobado por IA" — the AI recommends and a person approves, always attributed.
Mark simulated KYC and sales data wherever they appear.
TARGET_DEVICE: DESKTOP|MOBILE · TARGET_THEME: LIGHT|DARK
```

---

## 5. Verificación antes de aceptar cada pantalla

Correr esto sobre las piezas nuevas. Los primeros cinco son **obligatorios**; los tres últimos son
revisiones de contenido.

```sh
cd docs/design/template

# 1. Los disclosures y rótulos de confianza están presentes
for k in "No apto para producción" TESTNET SIMULADO "sin valor económico"; do
  printf '%-28s' "$k"; grep -l "$k" "Vaqcrow NUEVA.dc.html" | wc -l
done
# esperado: 1 en cada caso

# 2. Ningún término prohibido (debe dar vacío)
grep -ilE "Inversión segura|rentabilidad garantizada|Aprobado por IA|Dinero depositado|KYC verificado|Wallet de Vaqcrow|Pago real" "Vaqcrow NUEVA.dc.html"

# 3. Ambos temas definidos en el mismo archivo
grep -c 'data-theme="dark"' "Vaqcrow NUEVA.dc.html"   # esperado: >= 1
grep -c 'data-theme="light"' "Vaqcrow NUEVA.dc.html"  # esperado: >= 1

# 4. El runtime y los iconos son los del set (no otros)
grep -c 'src="./support.js"' "Vaqcrow NUEVA.dc.html"                    # esperado: 1
grep -c 'ionicons@7.4.0' "Vaqcrow NUEVA.dc.html"                        # esperado: 1
grep -c 'family=Geist' "Vaqcrow NUEVA.dc.html"                          # esperado: 1

# 5. No se introdujo otra librería de estilo
grep -ci "tailwind\|@heroui" "Vaqcrow NUEVA.dc.html"                    # esperado: 0
```

Revisiones de contenido (a ojo, no automatizables):

- **Lo enviado nunca se ve confirmado**: buscá `submitted`/`Enviado`/`Pendiente de confirmación` y
  verificá que el tono sea neutro, sin check verde ni celebración.
- **Ningún estado depende sólo del color**: revisá cada chip y badge.
- **Custodia explícita en la pantalla de fondeo**: la frase de que el contrato custodia y que es
  permissionless pero no auto-disparado tiene que estar visible, no implícita.

> [!tip] Endurecer la nav después de generar Billetera
> Agregá `Billetera` al `<nav>` de **las 15 piezas existentes** y de las nuevas, para que la navegación
> primaria coincida con el brief.

## 6. Limpieza del set actual

| Qué | Acción |
|---|---|
| `Vaqcrow Landing export.dc.html`, `Vaqcrow Landing.dc.html`, `Vaqcrow Landing.html` | Elegir **una** (la `.dc.html` con temas) y descartar las otras dos; el `Landing.html` de 2,9 MB no tiene temas ni runtime |
| `.DS_Store` (raíz y `uploads/`) | No versionar; agregar a `.gitignore` si el set se versiona |
| `uploads/` (48 PNG + `Polkadot2.jpeg` + copia del brief) | Material de trabajo del generador, **no** forma parte del set: no versionar |
| `screenshots/coins.jpg` | Revisar: "coins" es exactamente la iconografía que el brief prohíbe; si es referencia, fuera del set |
| `assets/` (10 imágenes, ~5,4 MB) | Sí forma parte del set: son las que referencian los `<img>` |
| Peso total | 25 MB → con la limpieza anterior baja a un orden versionable |
