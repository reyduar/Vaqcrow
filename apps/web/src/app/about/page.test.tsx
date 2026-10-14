import { render, screen, within } from "@testing-library/react";
import { SWRConfig } from "swr";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ABOUT_COPY } from "@/application/about/copy";
import { disclosures } from "@/application/trust/disclosures";
import { SessionStoreProvider } from "@/state/session-store-provider";
import { FakeAuthSession } from "@/test/fake-auth-session";

// The public shell reads the current path and the router; both are stubbed so
// the page renders without a Next.js runtime (same pattern as `/(app)` tests).
vi.mock("next/navigation", () => ({
  usePathname: () => "/about",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() })
}));

import AboutPage from "./page";

/** The creator CTA's owner-decided destination (template left it `#`). */
const CREATOR_PROFILE_HREF = "https://www.linkedin.com/in/arielduarte";

afterEach(() => {
  vi.unstubAllEnvs();
});

function renderPage() {
  // A fresh SWR cache per render: the Blog section (#498) fetches through SWR.
  return render(
    <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
      <SessionStoreProvider port={new FakeAuthSession()}>
        <AboutPage />
      </SessionStoreProvider>
    </SWRConfig>
  );
}

describe("/about", () => {
  it("renders the hero, mission, pillars, creator and contact sections", () => {
    renderPage();

    expect(screen.getByRole("heading", { level: 1, name: "Acerca de Vaqcrow" })).toBeInTheDocument();
    expect(screen.getByText(ABOUT_COPY.hero.eyebrow)).toBeInTheDocument();

    expect(screen.getByRole("heading", { level: 2, name: ABOUT_COPY.mission.title })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: ABOUT_COPY.pillars.title })).toBeInTheDocument();

    // The creator section carries the real name; its eyebrow is also the hero's
    // second CTA, so the text appears more than once by design.
    expect(screen.getByRole("heading", { level: 2, name: ABOUT_COPY.creator.name })).toBeInTheDocument();
    expect(screen.getAllByText(ABOUT_COPY.creator.eyebrow).length).toBeGreaterThan(0);

    expect(screen.getByRole("heading", { level: 2, name: ABOUT_COPY.contact.title })).toBeInTheDocument();
  });

  it("renders the demo stack card and all six pillars", () => {
    const { container } = renderPage();

    // Scoped to the card: the header badge also reads "TESTNET", and the
    // "Firma no custodial" row label repeats a pillar title.
    const stackCard = container.querySelector("[data-about-stack]");
    expect(stackCard).not.toBeNull();
    const card = within(stackCard as HTMLElement);
    expect(card.getByText(ABOUT_COPY.stack.subtitle)).toBeInTheDocument();
    expect(card.getByText(ABOUT_COPY.stack.badge)).toBeInTheDocument();
    for (const row of ABOUT_COPY.stack.rows) {
      expect(card.getByText(row.label)).toBeInTheDocument();
    }
    for (const pillar of ABOUT_COPY.pillars.items) {
      expect(screen.getByRole("heading", { level: 3, name: pillar.title })).toBeInTheDocument();
    }
  });

  it("renders the hero CTAs with their copy-sourced hrefs", () => {
    renderPage();

    for (const cta of ABOUT_COPY.hero.ctas) {
      const link = screen.getByRole("link", { name: new RegExp(cta.label) });
      expect(link).toHaveAttribute("href", cta.href);
    }
    expect(screen.getByRole("link", { name: ABOUT_COPY.creator.profileCta })).toHaveAttribute(
      "href",
      CREATOR_PROFILE_HREF
    );
  });

  it("renders the four contact CTAs with their exact real hrefs", () => {
    renderPage();

    const contact = screen.getByRole("heading", { level: 2, name: ABOUT_COPY.contact.title }).closest("section");
    expect(contact).not.toBeNull();

    for (const cta of ABOUT_COPY.contact.ctas) {
      const link = within(contact as HTMLElement).getByRole("link", { name: new RegExp(cta.label) });
      expect(link).toHaveAttribute("href", cta.href);
    }
  });

  it("renders the canonical no-production disclosure verbatim", () => {
    renderPage();

    // Scoped to `main`: the shared footer renders the same disclosure too.
    expect(within(screen.getByRole("main")).getByText(disclosures["no-production"].text)).toBeInTheDocument();
  });

  it("marks every decorative coin aria-hidden and non-interactive", () => {
    const { container } = renderPage();

    const coins = container.querySelectorAll("[data-decorative-coin]");
    expect(coins.length).toBeGreaterThan(0);
    for (const coin of coins) {
      expect(coin).toHaveAttribute("aria-hidden", "true");
      expect(coin.className).toContain("pointer-events-none");
    }
  });

  // Feature #498 / D4: the Blog is linked only from «Acerca de» (never the header
  // or footer). With no backend wired up the section stays honest instead of
  // inventing a list.
  it("renders the Blog section linking to /blog", async () => {
    vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "");
    renderPage();

    expect(screen.getByRole("heading", { level: 2, name: ABOUT_COPY.blog.title })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: ABOUT_COPY.blog.seeAll })).toHaveAttribute("href", "/blog");
    expect(await screen.findByText("Esta instancia no tiene configurada la API")).toBeInTheDocument();
  });
});
