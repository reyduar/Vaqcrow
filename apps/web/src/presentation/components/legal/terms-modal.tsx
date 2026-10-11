"use client";

import { Modal } from "@heroui/react";
import { useState } from "react";
import { TERMS_COPY } from "@/application/legal/terms";
import { Button } from "../button";
import { CanonicalDisclosure } from "../canonical-disclosure";

/**
 * The «Términos y Condiciones» modal (Feature #394 / WU5), following the
 * HeroUI v3 `Modal` compound pattern the marketplace filter dialog uses. It
 * renders `application/legal/terms.ts` verbatim and, for the sections that map
 * to a canonical notice, delegates to `CanonicalDisclosure` rather than
 * retyping the sentence.
 */
export const TERMS_DIALOG_ID = "vq-terms";

export interface TermsModalProps {
  readonly isOpen: boolean;
  readonly onClose: () => void;
}

export function TermsModal({ isOpen, onClose }: TermsModalProps) {
  return (
    <Modal.Backdrop
      isOpen={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <Modal.Container size="lg">
        <Modal.Dialog id={TERMS_DIALOG_ID} className="flex flex-col gap-4">
          <Modal.CloseTrigger aria-label="Cerrar términos" />
          <Modal.Header className="pr-8">
            <Modal.Heading>{TERMS_COPY.title}</Modal.Heading>
          </Modal.Header>

          <Modal.Body className="flex flex-col gap-5">
            <p className="m-0 text-sm text-text-secondary">{TERMS_COPY.intro}</p>
            {TERMS_COPY.sections.map((section) => (
              <section key={section.id} className="flex flex-col gap-2">
                <h3 className="m-0 text-base font-semibold text-text-primary">{section.heading}</h3>
                {section.body?.map((paragraph) => (
                  <p key={paragraph} className="m-0 text-sm text-text-secondary">
                    {paragraph}
                  </p>
                ))}
                {section.disclosure ? <CanonicalDisclosure id={section.disclosure} /> : null}
              </section>
            ))}
          </Modal.Body>

          <Modal.Footer className="flex flex-wrap items-center justify-between gap-3">
            <a
              href={TERMS_COPY.contact.href}
              className="text-sm font-medium text-brand-accent-text underline-offset-2 hover:underline"
            >
              {TERMS_COPY.contact.label}
            </a>
            <Button variant="secondary" onPress={onClose}>
              Cerrar
            </Button>
          </Modal.Footer>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}

/**
 * The «Términos» trigger that owns the modal's open state. It lives in the
 * shared `SiteFooter`, so the terms are reachable from every page. A button
 * (not a link) because the trigger opens a dialog, not a route.
 */
export function TermsTrigger() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        aria-haspopup="dialog"
        {...(isOpen ? { "aria-controls": TERMS_DIALOG_ID } : {})}
        onClick={() => setIsOpen(true)}
        className="cursor-pointer bg-transparent p-0 text-xs font-medium text-text-secondary underline-offset-2 hover:text-text-primary hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
      >
        Términos
      </button>
      <TermsModal isOpen={isOpen} onClose={() => setIsOpen(false)} />
    </>
  );
}
