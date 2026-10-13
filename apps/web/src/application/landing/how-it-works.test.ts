import { describe, expect, it } from "vitest";
import { HOW_IT_WORKS_KINDS, parseHowItWorks } from "./how-it-works";
import { HOW_IT_WORKS_GUIDE, readGuideSource } from "../../infrastructure/guides/read-guide-source";

const SAMPLE = `---
title: Ejemplo
tags:
  - demo
---

# Título del documento

Primer párrafo
del lead.

> [!info] Una nota
> que no es contenido de la sección.

## Uno

Cuerpo uno.

## Dos

Cuerpo
dos.

Un segundo párrafo.
`;

/**
 * The trace the landing renders, pinned. If the guide is reordered or a title is
 * reworded, this fails before the section can render the wrong badge.
 */
const PINNED_TITLES: readonly string[] = [
  "La PyME crea su cuenta",
  "Registra la PyME y sube los documentos",
  "La IA evalúa los documentos",
  "La PyME conecta Freighter",
  "Una persona aprueba",
  "La bóveda se despliega en Testnet",
  "La campaña se publica",
  "El inversor entra y conecta su wallet",
  "El inversor aporta",
  "La meta: todo o nada",
  "Meta alcanzada: la PyME recibe el capital",
  "Sin meta: reembolso a los contribuyentes",
  "La distribución mensual del revenue share"
];

describe("parseHowItWorks", () => {
  it("drops the frontmatter, the H1 and blockquotes, and keeps the lead", () => {
    expect(parseHowItWorks(SAMPLE).lead).toEqual(["Primer párrafo del lead."]);
  });

  it("returns one station per `##`, joining a wrapped paragraph with spaces", () => {
    const { stations } = parseHowItWorks(SAMPLE);

    expect(stations.map((station) => station.title)).toEqual(["Uno", "Dos"]);
    expect(stations[0]?.body).toEqual(["Cuerpo uno."]);
    expect(stations[1]?.body).toEqual(["Cuerpo dos.", "Un segundo párrafo."]);
  });
});

describe("the 「Cómo funciona」 guide", () => {
  const { lead, stations } = parseHowItWorks(readGuideSource(HOW_IT_WORKS_GUIDE));

  it("carries the framing in the lead and the whole trace, in order", () => {
    expect(lead).toHaveLength(2);
    expect(lead[1]).toContain("crowdequity");
    expect(stations.map((station) => station.title)).toEqual(PINNED_TITLES);
  });

  it("gives every station a body", () => {
    for (const station of stations) {
      expect(station.body.length).toBeGreaterThan(0);
    }
  });

  it("declares one kind per station: one fork and exactly two branches", () => {
    expect(HOW_IT_WORKS_KINDS).toHaveLength(stations.length);
    expect(HOW_IT_WORKS_KINDS.filter((kind) => kind === "fork")).toHaveLength(1);
    expect(HOW_IT_WORKS_KINDS.filter((kind) => kind === "branch")).toHaveLength(2);
  });
});
