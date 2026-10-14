"use client";

import { ASSISTANT_COPY } from "@/application/assistant/copy";
import { useSession } from "@/state/session-store-provider";
import { AssistantChat } from "../assistant/assistant-chat";
import { HelpContact } from "./help-contact";
import { HelpExplorer } from "./help-explorer";

/**
 * `/help` content (#394 / WU4, extended by #499/WU3): the interactive explorer
 * (hero search, categories and FAQ accordion) above the closing contact band.
 * The route wraps it in the public `AppShell`.
 *
 * A signed-in PYME or INVERSOR also gets the shared assistant chat (owner
 * decision D7); an anonymous visitor (and an ADMIN) keeps exactly the FAQ-only
 * page. This is now a Client Component only because it reads the session — the
 * explorer and the contact band are unchanged, and the route itself stays
 * public (no gate).
 */
export function HelpContent() {
  const role = useSession((state) => state.principal?.role ?? null);
  const canChat = role === "PYME" || role === "INVERSOR";

  return (
    <div className="flex flex-col gap-10">
      {canChat ? (
        <section aria-labelledby="asistente-t" className="flex flex-col gap-4 rounded-panel border border-page-border p-5">
          <div className="flex flex-col gap-1">
            <h2 id="asistente-t" className="m-0 text-[22px] font-bold">
              {ASSISTANT_COPY.title}
            </h2>
            <p className="m-0 text-sm text-text-secondary">{ASSISTANT_COPY.subtitle}</p>
          </div>
          <AssistantChat />
        </section>
      ) : null}
      <HelpExplorer />
      <HelpContact />
    </div>
  );
}
