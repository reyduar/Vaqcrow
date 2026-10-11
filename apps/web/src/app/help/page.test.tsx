import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { HELP_CATEGORIES, HELP_COPY, HELP_FAQS } from "@/application/help/faq";
import { SessionStoreProvider } from "@/state/session-store-provider";
import { FakeAuthSession } from "@/test/fake-auth-session";

// The public shell reads the current path and the router; both are stubbed so
// the page renders without a Next.js runtime (same pattern as `/about` and the
// guides).
vi.mock("next/navigation", () => ({
  usePathname: () => "/help",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() })
}));

import HelpPage from "./page";

const SEARCH_LABEL = HELP_COPY.search.label;

function renderPage() {
  return render(
    <SessionStoreProvider port={new FakeAuthSession()}>
      <HelpPage />
    </SessionStoreProvider>
  );
}

describe("/help", () => {
  it("is public: renders the help center without the template's login gate", () => {
    renderPage();

    expect(screen.getByRole("heading", { level: 1, name: HELP_COPY.hero.title })).toBeInTheDocument();
    // The template drew a gate (`:91-102`) the owner removed; this route must not model it.
    expect(screen.queryByText("Ingresá para leer la guía")).not.toBeInTheDocument();
  });

  it("renders every FAQ and category from the data", () => {
    renderPage();
    const main = within(screen.getByRole("main"));
    // Scoped to the group: a category label can also appear inside FAQ copy
    // (e.g. "Stellar Testnet").
    const categories = within(main.getByRole("group", { name: "Categorías" }));

    for (const faq of HELP_FAQS) {
      expect(main.getByRole("button", { name: faq.question })).toBeInTheDocument();
    }
    for (const category of HELP_CATEGORIES) {
      expect(categories.getByRole("button", { name: new RegExp(category.label) })).toBeInTheDocument();
    }
  });

  it("filters the FAQs live by question and answer as you type", () => {
    renderPage();
    const main = within(screen.getByRole("main"));
    const input = main.getByLabelText(SEARCH_LABEL);

    // "reembolso" only appears in an answer, so the filter must read answers too.
    fireEvent.change(input, { target: { value: "reembolso" } });
    expect(main.getByRole("button", { name: "¿Qué pasa si la campaña no llega a la meta?" })).toBeInTheDocument();
    expect(main.queryByRole("button", { name: "¿Qué es el revenue share?" })).not.toBeInTheDocument();

    // "revenue" only appears in a question, so the filter must read questions too.
    fireEvent.change(input, { target: { value: "revenue" } });
    expect(main.getByRole("button", { name: "¿Qué es el revenue share?" })).toBeInTheDocument();
    expect(main.queryByRole("button", { name: "¿Qué pasa si la campaña no llega a la meta?" })).not.toBeInTheDocument();
  });

  it("filters by category and reflects the count in the result label", () => {
    renderPage();
    const main = within(screen.getByRole("main"));
    const categories = within(main.getByRole("group", { name: "Categorías" }));
    const aportes = categories.getByRole("button", { name: /Aportes y reembolsos/ });

    expect(aportes).toHaveAttribute("aria-pressed", "false");

    fireEvent.click(aportes);

    expect(aportes).toHaveAttribute("aria-pressed", "true");

    expect(main.getByRole("button", { name: "¿Puedo retirar mi aporte?" })).toBeInTheDocument();
    expect(main.getByRole("button", { name: "¿Qué pasa si la campaña no llega a la meta?" })).toBeInTheDocument();
    expect(main.queryByRole("button", { name: "¿Qué es el revenue share?" })).not.toBeInTheDocument();
    expect(main.getByText("2 preguntas en Aportes y reembolsos")).toBeInTheDocument();
  });

  it("renders the exact empty-state copy with the typed term", () => {
    renderPage();
    const main = within(screen.getByRole("main"));

    fireEvent.change(main.getByLabelText(SEARCH_LABEL), { target: { value: "xyz" } });

    expect(main.getByText(HELP_COPY.emptyState.title("xyz"))).toBeInTheDocument();
    expect(main.getByText(HELP_COPY.emptyState.body)).toBeInTheDocument();
  });

  it("toggles a FAQ's aria-expanded when its button is pressed", () => {
    renderPage();
    const main = within(screen.getByRole("main"));
    const button = main.getByRole("button", { name: "¿La IA aprueba las campañas?" });

    expect(button).toHaveAttribute("aria-expanded", "false");
    const panelId = button.getAttribute("aria-controls");
    expect(panelId).toBeTruthy();
    const panel = document.getElementById(panelId as string);
    expect(panel).not.toBeNull();
    expect(panel).toHaveAttribute("hidden");

    fireEvent.click(button);
    expect(button).toHaveAttribute("aria-expanded", "true");
    expect(panel).not.toHaveAttribute("hidden");

    fireEvent.click(button);
    expect(button).toHaveAttribute("aria-expanded", "false");
    expect(panel).toHaveAttribute("hidden");
  });

  it("renders the contact block links with their exact hrefs", () => {
    renderPage();
    const main = within(screen.getByRole("main"));

    expect(main.getByRole("link", { name: HELP_COPY.contact.email.label })).toHaveAttribute(
      "href",
      HELP_COPY.contact.email.href
    );
    expect(main.getByRole("link", { name: HELP_COPY.contact.guide.label })).toHaveAttribute(
      "href",
      HELP_COPY.contact.guide.href
    );
  });

  it("renders the static upcoming-assistant note", () => {
    renderPage();

    expect(within(screen.getByRole("main")).getByText(HELP_COPY.upcoming)).toBeInTheDocument();
  });
});
