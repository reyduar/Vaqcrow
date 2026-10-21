---
title: La wiki de Karpathy: cómo construimos el asistente de Vaqcrow sin embeddings
tags:
  - blog
  - ia
  - rag
  - llm-wiki
  - asistente
---

# La wiki de Karpathy: cómo construimos el asistente de Vaqcrow sin embeddings

El asistente de ayuda de Vaqcrow responde preguntas sobre la plataforma leyendo una **wiki de 18 páginas en Markdown**. No usa una base de datos vectorial, ni *embeddings*, ni un buscador semántico. Sigue el método que Andrej Karpathy llamó **LLM Wiki**: en vez de buscar fragmentos de documentos en cada pregunta, un modelo **compila una vez** el conocimiento en páginas ordenadas y después las navega desde un índice.

Este artículo explica en qué se basa el método, en qué se diferencia del RAG tradicional, qué cuesta, cuáles son sus límites y, sobre todo, cómo lo construimos para Vaqcrow.

> El asistente es una ayuda para entender la plataforma, no un asesor financiero. Responde sólo con la documentación de Vaqcrow y, si no tiene una página que cubra la pregunta, lo dice.

## Primero, el RAG tradicional

**RAG** (*Retrieval-Augmented Generation*) es la técnica más usada para que un modelo de lenguaje responda sobre documentos propios. La propuso un equipo de Facebook AI en 2020, en el artículo [*Retrieval-Augmented Generation for Knowledge-Intensive NLP Tasks*](https://arxiv.org/abs/2005.11401): combinar la memoria que el modelo trae en sus pesos con un **índice vectorial denso** de documentos, consultado por un recuperador neuronal.

En la práctica, un sistema RAG típico hace esto:

1. Corta los documentos en **fragmentos** (*chunks*) de unos cientos de palabras.
2. Convierte cada fragmento en un **embedding**: un vector de números que representa su significado.
3. Guarda esos vectores en una **base de datos vectorial**.
4. En cada pregunta, convierte la pregunta en otro vector, busca los fragmentos más parecidos y se los pasa al modelo para que redacte la respuesta.

Funciona, y a gran escala es la herramienta correcta. Pero tiene costos conocidos:

- **El corte pierde contexto.** Anthropic lo ilustra en [*Contextual Retrieval*](https://www.anthropic.com/news/contextual-retrieval) con un fragmento que dice «los ingresos de la empresa crecieron un 3 %» sin decir de qué empresa habla.
- **Hace falta infraestructura**: un modelo de embeddings, una base vectorial y, para recuperar bien, búsqueda léxica y un reordenador (*re-ranker*). En ese mismo artículo, sumar esas piezas reduce bastante las recuperaciones fallidas, lo que deja ver cuán frágil es la versión básica.
- **No acumula.** Cada pregunta vuelve a armar la respuesta desde fragmentos sueltos. Nada de lo que se entendió en la pregunta anterior queda guardado para la siguiente.

## La idea de Karpathy: compilar en vez de buscar

El **2 de abril de 2026**, Andrej Karpathy publicó en X [un hilo sobre *LLM Knowledge Bases*](https://x.com/karpathy/status/2039805659525644595). Contaba que una buena parte de su uso de modelos ya no iba a escribir código sino a manipular conocimiento guardado en Markdown. Su flujo: juntar las fuentes —artículos, papers, repositorios— en una carpeta `raw/` y usar un modelo para **«compilar» incrementalmente una wiki**, «que no es más que una colección de archivos .md».

Lo llamativo fue la escala a la que le alcanzó: una wiki de unos **100 artículos y 400.000 palabras**. Escribió que creía que iba a necesitar «un RAG sofisticado», pero que el modelo mantenía bien los índices y los resúmenes «a esta escala chica».

Dos días después publicó la idea completa en un *gist*, [**llm-wiki.md**](https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f), pensado para copiarlo y dárselo a un agente como Claude Code, Codex u OpenCode. Su diagnóstico del RAG es directo: el modelo **«redescubre el conocimiento desde cero en cada pregunta. No hay acumulación»**. En la wiki, en cambio, el conocimiento **«se compila una vez y después se mantiene al día, no se vuelve a derivar en cada consulta»**.

### Las tres capas

| Capa | Qué es | Quién la escribe |
|---|---|---|
| **Fuentes crudas** | Los documentos originales. Son **inmutables**: el modelo los lee pero nunca los modifica. Son la fuente de verdad. | Las personas. |
| **La wiki** | Páginas en Markdown, una por tema, con un índice. | El modelo. «Vos la leés; el modelo la escribe.» |
| **El esquema** | Un documento (como `CLAUDE.md` o `AGENTS.md`) que fija cómo se escribe y se mantiene la wiki. | Las personas, junto con el modelo. |

### Las tres operaciones

- **Ingest**: leer una fuente nueva y crear o actualizar las páginas que toca. Según Karpathy, una sola fuente puede tocar entre 10 y 15 páginas.
- **Query**: responder una pregunta navegando la wiki. Las buenas respuestas pueden volver a la wiki como páginas nuevas.
- **Lint**: revisar la salud de la wiki: contradicciones entre páginas, afirmaciones viejas que una fuente nueva dejó atrás y páginas huérfanas.

Dos archivos ordenan todo: `index.md`, el catálogo de cada página con una línea de descripción, y `log.md`, la bitácora de lo que pasó y cuándo.

### Por qué funcionaría ahora

Karpathy lo conecta con el **Memex** que imaginó Vannevar Bush en 1945: una memoria personal enlazada. La parte que Bush no pudo resolver, dice, era **quién hace el mantenimiento**. Las personas abandonan las wikis porque mantenerlas cuesta más de lo que rinden. Un modelo de lenguaje puede hacer ese mantenimiento casi gratis.

## LLM Wiki frente a RAG tradicional

| | RAG tradicional | LLM Wiki |
|---|---|---|
| Qué se guarda | Fragmentos y sus vectores | Páginas compiladas, una por tema |
| Cuándo se entiende el contenido | En cada pregunta | Una vez, al compilar |
| Cómo se encuentra lo relevante | Similitud entre vectores | El modelo lee el índice y elige páginas |
| Infraestructura | Modelo de embeddings, base vectorial, a veces re-ranker | Archivos Markdown y un modelo |
| Qué ve una persona | Fragmentos opacos | Páginas legibles que se pueden revisar |
| Dónde brilla | Corpus grandes y cambiantes | Corpus chicos o medianos y bien curados |
| Cuándo se queda corto | Preguntas que cruzan muchos fragmentos | Cuando el índice ya no entra cómodo en el contexto |

## Cuánto cuesta

Conviene ser honestos: **no encontramos una medición publicada** que compare el costo de una LLM Wiki con el de un RAG vectorial. Lo que sí se puede describir es **dónde se paga** en cada caso:

- **En la LLM Wiki, el gasto grande ocurre al compilar.** Cada *ingest* consume tokens leyendo la fuente y reescribiendo páginas, más el tiempo de una persona revisando. Después, cada pregunta es barata: el modelo lee un índice corto y unas pocas páginas.
- **En el RAG, el gasto se reparte entre la infraestructura y cada consulta**: generar los embeddings, mantener la base vectorial y, en cada pregunta, recuperar y pasarle fragmentos al modelo.
- **La LLM Wiki elimina piezas enteras**: no hay modelo de embeddings, ni base vectorial que operar, ni proveedor extra que pagar.

Una referencia útil, aunque es de otra técnica: Anthropic sugiere que, si toda la base de conocimiento ocupa menos de unos **200.000 tokens**, directamente se la puede poner entera en el prompt, y que el *prompt caching* recorta mucho el costo de repetirla ([fuente](https://www.anthropic.com/news/contextual-retrieval)). Es otra forma de decir lo mismo que Karpathy: **a escala chica, buscar es más caro que leer**.

## Los límites del método

- **La escala.** Karpathy la acota él mismo: el índice alcanza para unas **100 fuentes y cientos de páginas**. Para wikis más grandes recomienda [qmd](https://github.com/tobi/qmd), un buscador local que combina búsqueda léxica (BM25), búsqueda vectorial y reordenamiento con un modelo. O sea: a gran escala, **la búsqueda vectorial vuelve**.
- **El modelo puede compilar mal.** Si una página queda con un error, ese error se repite en cada respuesta que la use. Por eso el *lint* y la revisión humana no son opcionales en la práctica.
- **Las páginas envejecen.** Si el producto cambia y nadie vuelve a compilar, la wiki dice cosas que ya no son ciertas.
- **El contexto largo también tiene problemas.** Un estudio conocido, [*Lost in the Middle*](https://arxiv.org/abs/2307.03172), mostró que los modelos rinden peor cuando la información relevante queda en el medio de un contexto muy largo. Leer pocas páginas elegidas ayuda; cargar todo, no tanto.
- **No «jubila» al RAG.** Algunos titulares lo presentaron así. Karpathy no dice eso: dice que, **a su escala**, no le hizo falta.

## Cómo lo construimos en Vaqcrow

### Las tres capas, en el repositorio

| Capa de Karpathy | En Vaqcrow |
|---|---|
| Fuentes crudas | `docs/guides/`: la guía «Cómo funciona», el recorrido con Freighter y los artículos de este mismo Blog. |
| La wiki | `docs/wiki/`: 18 páginas compiladas, más `index.md` y `log.md`. |
| El esquema | `docs/wiki/schema.md`: tipos de página, formato, reglas del índice y operaciones. |

Cada página declara de qué fuentes sale (`sources`) y de qué tipo es: **concepto** («qué es el revenue share»), **flujo** («la distribución mensual»), **tecnología** («la bóveda en Soroban»), **pantalla** («Mi campaña») o **límite** («qué es real y qué es simulado»). La regla de oro del esquema: **toda afirmación de una página tiene que poder rastrearse a una fuente**. Una página sin fuente no entra.

### Quién compila y quién revisa

El *ingest* lo hace un agente de programación, siguiendo `schema.md`, en un *pull request*. **Una persona lo revisa antes de mergear.** Y el *lint* no queda librado a la buena voluntad: corre como tests en cada cambio.

- Cada página está en el índice y cada línea del índice tiene su archivo: no hay huérfanas.
- Cada página declara un tipo y cita fuentes que existen en `docs/guides/`.
- Ninguna página usa las palabras que la copy pública de Vaqcrow tiene prohibidas, la misma lista que se aplica a la web y al Blog.

Cuando publicamos [el artículo sobre el ecosistema Stellar](/blog/ecosistema-stellar-de-vaqcrow), por ejemplo, el mismo cambio compiló su página en la wiki, la agregó al índice y dejó la entrada en la bitácora.

### Una pregunta, de punta a punta

```text
persona                  API de Vaqcrow                          modelo
 │ «¿Qué pasa si la campaña no llega a la meta?»
 │ ─────────────────────▶ ¿rol PYME o INVERSOR? ¿chat habilitado?
 │                        ¿menos de 5 preguntas en 24 h?
 │                        1. ROUTER: le muestra sólo index.md ───▶ elige páginas
 │                           y si la pregunta está dentro del tema ◀── {scope, pages}
 │                        valida que cada página exista en el índice
 │                        2. RESPUESTA: le muestra sólo esas páginas ─▶ redacta
 │                                                              ◀── respuesta + citas
 │                        valida que cite sólo páginas elegidas
 │ ◀───────────────────── respuesta corta + enlaces a las páginas citadas
```

Son **dos llamadas al modelo** por pregunta:

1. **El router** ve sólo el índice: 18 líneas, una por página. Decide si la pregunta es sobre Vaqcrow, si es sobre la cuenta de la persona o si está fuera de tema, y qué páginas leer. El código descarta cualquier página que el router nombre y no esté en el índice.
2. **La respuesta** ve sólo las páginas elegidas y redacta en español, **en dos a cinco frases**, sin inventar. Si cita una página que no le dieron, la salida se descarta.

Si algo sale mal —una respuesta que no se puede interpretar, o que se corta—, se reintenta **una vez**. Si vuelve a fallar, el asistente no improvisa: responde que no tiene documentación.

### Cuatro respuestas fijas

Hay casos en los que el modelo **no redacta**: el asistente devuelve un texto fijo, escrito por personas.

| Caso | Respuesta |
|---|---|
| Fuera de tema | «Puedo ayudarte solo con Vaqcrow: qué es, cómo funciona y su tecnología. Para otros temas no soy de utilidad.» |
| Sin página que lo cubra | «No tengo documentación sobre eso. Podés leer las guías y el Blog, o escribir a soporte: contact@vaqcrow.com.» |
| Sobre la cuenta propia | «La información de tu cuenta está en tus informes. Si no lo encontrás ahí, escribí a soporte: contact@vaqcrow.com.» |
| Límite de preguntas alcanzado | «Te sugiero leer los artículos del Blog: ahí cubrimos Vaqcrow con más detalle.» |

La segunda es la más importante: **sin documento, no hay respuesta**. El asistente nunca contesta desde lo que el modelo «sabe» por su cuenta.

### Seguridad: el contenido es un dato, no una orden

Tanto la pregunta como el texto de la wiki se le pasan al modelo marcados como **datos no confiables**: algo para leer, nunca instrucciones para obedecer. Es la defensa básica contra la *inyección de prompts*, cuando alguien escribe «ignorá tus reglas y…» dentro de la pregunta. Además, el código valida todo lo que el modelo devuelve: páginas que existan, citas permitidas y formato correcto.

### Acceso, límites y privacidad

- **Sólo para cuentas PyME e inversor**, con sesión iniciada. Quien visita sin cuenta ve las preguntas frecuentes.
- **Un admin habilita el chat por cuenta.** Viene apagado por defecto.
- **Hasta 5 preguntas cada 24 horas por persona**, como control de abuso.
- **No se guarda el texto de las preguntas**: sólo el momento en que se hicieron, para contar el límite.
- **Una pregunta, una respuesta.** No hay historial de conversación.

### Las piezas técnicas

- **Modelos**: los de **OpenCode Go**, el mismo proveedor que ya usa la evaluación con IA de Vaqcrow, con temperatura 0 para que las respuestas sean estables. Router y respuesta pueden usar modelos distintos, configurados por variables de entorno.
- **Sin proveedor extra.** Se evaluó un modelo de embeddings de pago y se descartó: para una demo no valía sumar otro proveedor ni otra clave.
- **La wiki viaja con la API.** Los archivos se copian dentro de la imagen del servidor y se leen del disco en cada pregunta. No hay base de datos de por medio.
- **Tests sin red.** Los tests que corren en cada *pull request* usan un modelo de mentira y nunca llaman al proveedor real.

### En qué nos apartamos de Karpathy

- **Las respuestas no vuelven a la wiki.** Karpathy propone archivar las buenas respuestas como páginas nuevas. Nosotros no: el asistente sólo lee, y la wiki cambia únicamente por *pull request* revisado. Para una plataforma que explica dinero, preferimos que nada entre al corpus sin una persona de por medio.
- **El esquema es más estricto.** Cada página tiene que citar su fuente, y el lint corre como test automático, no como una revisión a pedido.
- **Estamos muy por debajo del techo.** Son 18 páginas, frente a las ~100 fuentes que Karpathy señala como límite cómodo. Si el corpus creciera mucho, el paso siguiente documentado en el esquema es un prefiltro léxico, como BM25 o la búsqueda de texto completo de Postgres en español, **todavía sin embeddings**.

### Límites honestos

- La respuesta llega completa, no palabra por palabra: el *streaming* quedó para más adelante.
- Algunas páginas de la wiki describen pantallas cuyo texto vive en el código de la web, no en `docs/guides/`. Esas páginas están menos atadas a su fuente que el resto.
- El documento de evidencia de esta *Feature* todavía está pendiente.

## Lecturas y videos

**Las fuentes de Karpathy**

- [El hilo original en X](https://x.com/karpathy/status/2039805659525644595) (2 de abril de 2026).
- [El gist *llm-wiki.md*](https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f), con las capas, las operaciones y el esquema.

**Sobre RAG**

- [El artículo que propuso RAG](https://arxiv.org/abs/2005.11401) (Lewis y otros, 2020).
- [*Contextual Retrieval*](https://www.anthropic.com/news/contextual-retrieval), de Anthropic, sobre los límites del corte en fragmentos.
- [*Lost in the Middle*](https://arxiv.org/abs/2307.03172), sobre el rendimiento con contextos largos.

**En español**

- [noticias.ai](https://noticias.ai/andrej-karpathy-propone-llm-wiki-una-nueva-forma-de-usar-la-ia-para-construir-una-base-de-conocimiento-viva/): un resumen fiel del gist, con las tres capas y las operaciones.
- [Optimoclick](https://www.optimoclick.com/blog/karpathy-propone-una-ia-que-gestiona-el-conocimiento-y-jubila-al-sistema-rag/): una lectura del primer hilo. Su titular dice que la idea «jubila» al RAG, algo que Karpathy no afirma.
- [YouMind](https://youmind.com/es-419/blog/how-to-build-karpathy-llm-knowledge-base-with-zero-code-zh): una guía para armar la wiki sin código, escrita por la empresa que vende la herramienta.
- [«Google acaba de romper el RAG»](https://www.youtube.com/watch?v=Z-h2iUWn4TM), de CodeSimple: sobre un formato de Google para conocimiento en Markdown, emparentado con esta idea.
- [Curso completo de RAG](https://www.youtube.com/watch?v=btyXpzHak1k), de Nico CMW: el RAG clásico de punta a punta, útil para entender contra qué se compara la wiki.

## En resumen

La LLM Wiki cambia el momento en que se entiende el conocimiento: **una vez, al compilar**, en vez de en cada pregunta. A la escala de Vaqcrow eso nos dio un asistente sin infraestructura vectorial, con un corpus que cualquiera puede leer y revisar en un *pull request*, y con una regla simple: si no está en la wiki, el asistente no lo responde.
