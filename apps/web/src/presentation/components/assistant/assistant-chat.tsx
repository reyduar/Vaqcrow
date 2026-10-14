"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { IoSendOutline } from "react-icons/io5";
import type { AssistantCitation } from "@vaqcrow/contracts";
import type { AssistantPort } from "@/application/assistant/assistant-port";
import { ASSISTANT_COPY, assistantErrorCopy } from "@/application/assistant/copy";
import type { AssistantMessage } from "@/state/assistant-store";
import { AssistantStoreProvider, useAssistant } from "@/state/assistant-store-provider";

/**
 * The shared help-assistant chat (#499, WU3). One component, rendered by the
 * floating assistant on the landing and by `/help`, so both mount points show
 * the same conversation, input and send action.
 *
 * It owns nothing vendor-specific: it reads the message list, the pending flag
 * and the last error from the per-mount store (`AssistantStoreProvider`) and
 * sends through the injected port. Every visible string comes from
 * `application/assistant/copy.ts` — the four D8 fixed answers arrive as ordinary
 * answers from the API and are rendered verbatim; only a failure or the `403`
 * access string is turned into copy here.
 *
 * Boundary: the answer and the citations are untrusted content. They are
 * rendered as text; a citation is a `next/link` only to the app screen the wiki
 * page declared, never an arbitrary URL from the model.
 */

const FOCUS_RING = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring";

function Citations({ citations }: { readonly citations: readonly AssistantCitation[] }) {
  if (citations.length === 0) return null;
  return (
    <div className="mt-2 flex flex-col gap-1">
      <span className="text-[11px] font-semibold tracking-[0.04em] text-text-secondary uppercase">
        {ASSISTANT_COPY.citationsLabel}
      </span>
      <ul className="m-0 flex list-none flex-col gap-1 p-0">
        {citations.map((citation) =>
          citation.screen === null ? (
            <li key={citation.id} className="text-[13px] text-text-secondary">
              {citation.title}
            </li>
          ) : (
            <li key={citation.id}>
              <Link href={citation.screen} className={`text-[13px] font-semibold text-brand-accent-text ${FOCUS_RING}`}>
                {citation.title}
              </Link>
            </li>
          )
        )}
      </ul>
    </div>
  );
}

function Message({ message }: { readonly message: AssistantMessage }) {
  const isUser = message.role === "user";
  return (
    <div className={isUser ? "flex flex-col items-end" : "flex flex-col items-start"}>
      <span className="sr-only">{isUser ? ASSISTANT_COPY.you : ASSISTANT_COPY.title}</span>
      <div
        className={`max-w-[92%] rounded-[12px] px-3 py-2.5 text-sm leading-[1.5] ${
          isUser ? "bg-brand-accent-tint text-text-primary" : "bg-surface text-text-primary"
        }`}
      >
        {message.text}
        {isUser ? null : <Citations citations={message.citations} />}
      </div>
    </div>
  );
}

function AssistantChatView() {
  const messages = useAssistant((state) => state.messages);
  const pending = useAssistant((state) => state.pending);
  const lastError = useAssistant((state) => state.lastError);
  const ask = useAssistant((state) => state.ask);
  const [draft, setDraft] = useState("");

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const question = draft;
    setDraft("");
    void ask(question);
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2" aria-live="polite">
        {messages.length === 0 ? (
          <div className="max-w-[92%] self-start rounded-[12px_12px_12px_4px] bg-surface px-3 py-2.5 text-sm leading-[1.5]">
            {ASSISTANT_COPY.greeting}
          </div>
        ) : (
          messages.map((message) => <Message key={message.id} message={message} />)
        )}
        {pending ? (
          <p role="status" className="m-0 text-[13px] text-text-secondary">
            {ASSISTANT_COPY.sending}
          </p>
        ) : null}
        {lastError ? (
          <p role="alert" className="m-0 text-[13px] font-medium text-trust-critical">
            {assistantErrorCopy(lastError)}
          </p>
        ) : null}
      </div>

      <form onSubmit={submit} className="flex h-11 items-center gap-2 rounded-control border border-control pr-1.5 pl-3">
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          disabled={pending}
          aria-label={ASSISTANT_COPY.inputLabel}
          placeholder={ASSISTANT_COPY.placeholder}
          className="min-w-0 flex-1 border-0 bg-transparent text-sm text-text-primary outline-none disabled:opacity-60"
        />
        <button
          type="submit"
          disabled={pending}
          aria-label={ASSISTANT_COPY.send}
          className={`inline-flex h-8 items-center gap-1.5 rounded-control bg-brand-accent px-2.5 text-[13px] font-semibold text-on-accent hover:bg-brand-accent-hover disabled:opacity-50 ${FOCUS_RING}`}
        >
          <IoSendOutline aria-hidden="true" focusable="false" className="text-base" />
          {ASSISTANT_COPY.send}
        </button>
      </form>
    </div>
  );
}

export interface AssistantChatProps {
  /** Injected in tests; production builds the browser port once per mount. */
  readonly port?: AssistantPort;
}

export function AssistantChat({ port }: AssistantChatProps) {
  return (
    <AssistantStoreProvider {...(port === undefined ? {} : { port })}>
      <AssistantChatView />
    </AssistantStoreProvider>
  );
}
