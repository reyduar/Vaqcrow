import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MarkdownBody } from "./markdown-body";

describe("MarkdownBody", () => {
  it("renders headings, paragraphs, lists, links, code and images", () => {
    const markdown = [
      "# Encabezado",
      "## Subtítulo",
      "Un párrafo con **negrita** y *cursiva*.",
      "",
      "- uno",
      "- dos",
      "",
      "1. primero",
      "",
      "[Vaqcrow](https://vaqcrow.com)",
      "",
      "`código en línea`",
      "",
      "```ts",
      "const x = 1;",
      "```",
      "",
      "![Logo de Vaqcrow](/logo.png)"
    ].join("\n");

    render(<MarkdownBody markdown={markdown} />);

    // Heading levels are shifted one down so the article's own <h1> is the page
    // title and the body never introduces a second one.
    expect(screen.getByRole("heading", { level: 2, name: "Encabezado" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 3, name: "Subtítulo" })).toBeInTheDocument();
    expect(screen.getByText(/Un párrafo con/)).toBeInTheDocument();
    expect(screen.getByText("negrita")).toBeInTheDocument();
    expect(screen.getByText("uno")).toBeInTheDocument();
    expect(screen.getByText("primero")).toBeInTheDocument();
    expect(screen.getByText("código en línea")).toBeInTheDocument();
    expect(screen.getByText("const x = 1;")).toBeInTheDocument();
    expect(screen.getAllByRole("listitem")).toHaveLength(3);
  });

  it("renders an external link in a new tab with a safe rel", () => {
    render(<MarkdownBody markdown="[Vaqcrow](https://vaqcrow.com)" />);

    const link = screen.getByRole("link", { name: "Vaqcrow" });
    expect(link).toHaveAttribute("href", "https://vaqcrow.com");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noreferrer noopener");
  });

  it("renders tabular content from GFM tables", () => {
    render(<MarkdownBody markdown={["| A | B |", "| --- | --- |", "| 1 | 2 |"].join("\n")} />);

    expect(screen.getByRole("table")).toBeInTheDocument();
  });

  it("renders images with a resolved source", () => {
    render(<MarkdownBody markdown="![Logo de Vaqcrow](/logo.png)" />);

    expect(screen.getByRole("img", { name: "Logo de Vaqcrow" })).toHaveAttribute("src", "/logo.png");
  });

  it("does not turn raw HTML into DOM or execute it", () => {
    const { container } = render(
      <MarkdownBody markdown={"<script>window.__pwned = true;</script>\n\nTexto visible"} />
    );

    expect(container.querySelector("script")).toBeNull();
    expect(container.innerHTML).not.toContain("<script");
    expect(screen.getByText("Texto visible")).toBeInTheDocument();
  });
});
