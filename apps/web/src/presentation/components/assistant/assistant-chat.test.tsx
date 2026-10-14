import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { AssistantAskResult, AssistantPort } from "@/application/assistant/assistant-port";
import { ASSISTANT_COPY } from "@/application/assistant/copy";
import { AssistantChat } from "./assistant-chat";

/**
 * The shared chat (#499, WU3) — one component, rendered by the floating
 * assistant and by `/help`. It renders the conversation, the input and the send
 * action, plus the fixed-copy states (the four D8 answers arrive as ordinary
 * answers; only the failures and the 403 access string are rendered here).
 */

function fakePort(result: AssistantAskResult): AssistantPort & { readonly calls: string[] } {
  const calls: string[] = [];
  return {
    calls,
    ask: vi.fn(async (question: string) => {
      calls.push(question);
      return result;
    })
  };
}

function typedQuestion(): HTMLInputElement {
  return screen.getByLabelText(ASSISTANT_COPY.inputLabel);
}

describe("AssistantChat", () => {
  it("greets before any question and sends the typed one to the port", async () => {
    const port = fakePort({
      ok: true,
      answer: {
        answer: "El revenue share es un porcentaje de tus ventas.",
        citations: [{ id: "que-es-vaqcrow", title: "Qué es Vaqcrow", screen: "/about" }]
      }
    });
    render(<AssistantChat port={port} />);

    expect(screen.getByText(ASSISTANT_COPY.greeting)).toBeInTheDocument();

    fireEvent.change(typedQuestion(), { target: { value: "¿Qué es el revenue share?" } });
    fireEvent.submit(typedQuestion().closest("form") as HTMLFormElement);

    expect(await screen.findByText("El revenue share es un porcentaje de tus ventas.")).toBeInTheDocument();
    expect(port.calls).toEqual(["¿Qué es el revenue share?"]);
    // The citation is rendered and links to the screen it names (D10).
    expect(screen.getByRole("link", { name: /Qué es Vaqcrow/ })).toHaveAttribute("href", "/about");
  });

  it("renders a citation without a screen as text, not a dead link", async () => {
    const port = fakePort({
      ok: true,
      answer: {
        answer: "Respuesta.",
        citations: [{ id: "glosario", title: "Glosario", screen: null }]
      }
    });
    render(<AssistantChat port={port} />);

    fireEvent.change(typedQuestion(), { target: { value: "pregunta" } });
    fireEvent.submit(typedQuestion().closest("form") as HTMLFormElement);

    expect(await screen.findByText("Glosario")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Glosario/ })).toBeNull();
  });

  it("answers 403 with the account-access copy, not a service failure", async () => {
    const port = fakePort({ ok: false, code: "forbidden" });
    render(<AssistantChat port={port} />);

    fireEvent.change(typedQuestion(), { target: { value: "¿Qué es Vaqcrow?" } });
    fireEvent.submit(typedQuestion().closest("form") as HTMLFormElement);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "El asistente todavía no está habilitado para tu cuenta."
    );
  });

  it.each([
    ["unavailable", ASSISTANT_COPY.errors.unavailable],
    ["network", ASSISTANT_COPY.errors.network],
    ["not_configured", ASSISTANT_COPY.errors.not_configured]
  ] as const)("shows the %s copy", async (code, copy) => {
    const port = fakePort({ ok: false, code });
    render(<AssistantChat port={port} />);

    fireEvent.change(typedQuestion(), { target: { value: "pregunta" } });
    fireEvent.submit(typedQuestion().closest("form") as HTMLFormElement);

    expect(await screen.findByRole("alert")).toHaveTextContent(copy);
  });

  it("shows each fixed answer (declined / no-documentation / cap / account) verbatim", async () => {
    for (const answer of [
      "Puedo ayudarte solo con Vaqcrow: qué es, cómo funciona y su tecnología. Para otros temas no soy de utilidad.",
      "No tengo documentación sobre eso. Podés leer las guías y el Blog, o escribir a soporte.",
      "Te sugiero leer los artículos del Blog: ahí cubrimos Vaqcrow con más detalle.",
      "La información de tu cuenta está en tus informes. Si no lo encontrás ahí, escribí a soporte."
    ]) {
      const port = fakePort({ ok: true, answer: { answer, citations: [] } });
      const { unmount } = render(<AssistantChat port={port} />);

      fireEvent.change(typedQuestion(), { target: { value: "pregunta" } });
      fireEvent.submit(typedQuestion().closest("form") as HTMLFormElement);
      expect(await screen.findByText(answer)).toBeInTheDocument();
      expect(screen.queryByRole("alert")).toBeNull();

      unmount();
    }
  });

  it("disables the input and the send action while a question is in flight", async () => {
    let resolve!: (value: AssistantAskResult) => void;
    const ask = vi.fn(() => new Promise<AssistantAskResult>((r) => { resolve = r; }));
    render(<AssistantChat port={{ ask }} />);

    fireEvent.change(typedQuestion(), { target: { value: "pregunta" } });
    fireEvent.submit(typedQuestion().closest("form") as HTMLFormElement);

    expect(typedQuestion()).toBeDisabled();
    const form = typedQuestion().closest("form") as HTMLFormElement;
    expect(within(form).getByRole("button", { name: ASSISTANT_COPY.send })).toBeDisabled();

    resolve({ ok: true, answer: { answer: "Listo.", citations: [] } });
    await waitFor(() => expect(typedQuestion()).not.toBeDisabled());
  });
});
