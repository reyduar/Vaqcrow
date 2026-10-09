"use client";

import { Modal } from "@heroui/react";
import { Badge } from "../badge";
import { Button } from "../button";

/**
 * The investor's one-shot simulated-KYC interstitial (Feature #422, WU4).
 *
 * It is shown once, after the investor presses "Aportar a la campaña" and before
 * the review modal, and only while the investor is not yet approved (owner
 * decision D2). The verification is simulated and auto-approved: the copy says
 * so plainly and carries the `SIMULADO` badge, never pretending to be a real
 * identity check. Every value and handler is a prop; the component never talks
 * to the KYC port itself.
 *
 * COPY STATUS: owner-pending. The template does not design an investor KYC, so
 * this copy is a minimal, honest placeholder recorded in the WU4 task log; the
 * owner must approve or replace it.
 */
export interface InvestorKycInterstitialProps {
  readonly isOpen: boolean;
  readonly isApproving: boolean;
  /** The approve call failed: keep the dialog open with an honest retry. */
  readonly failed: boolean;
  readonly onConfirm: () => void;
  readonly onClose: () => void;
}

export function InvestorKycInterstitial({
  isOpen,
  isApproving,
  failed,
  onConfirm,
  onClose
}: InvestorKycInterstitialProps) {
  return (
    <Modal.Backdrop
      isOpen={isOpen}
      isDismissable={!isApproving}
      isKeyboardDismissDisabled={isApproving}
      onOpenChange={(open) => {
        if (!open && !isApproving) {
          onClose();
        }
      }}
    >
      <Modal.Container size="md">
        <Modal.Dialog className="flex flex-col gap-4">
          <Modal.CloseTrigger aria-label="Cerrar" isDisabled={isApproving} />
          <Modal.Header className="flex flex-col gap-1 pr-8">
            <span className="text-sm font-medium text-brand-accent">Antes de aportar</span>
            <Modal.Heading>Verificación de identidad</Modal.Heading>
          </Modal.Header>

          <Modal.Body className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="simulado" label="SIMULADO" lang="es" />
              <span className="text-sm text-muted">No es una verificación real</span>
            </div>
            <p className="m-0 text-sm text-muted">
              Es tu primer aporte. En esta demo la verificación de identidad del inversor es simulada: no se revisa ningún
              documento real ni se valida tu identidad.
            </p>
            <p className="m-0 text-sm text-muted">
              Al continuar, la simulación queda aprobada en tu cuenta y no vuelve a pedirse.
            </p>
            {failed ? (
              <p role="alert" className="m-0 text-sm text-trust-critical">
                No pudimos registrar la verificación simulada. Reintentá.
              </p>
            ) : null}
          </Modal.Body>

          <Modal.Footer className="flex justify-end gap-2">
            <Button variant="secondary" isDisabled={isApproving} onPress={onClose}>
              Cancelar
            </Button>
            <Button
              variant="primary"
              isDisabled={isApproving}
              isLoading={isApproving}
              loadingLabel="Aprobando…"
              onPress={onConfirm}
            >
              Aprobar y continuar
            </Button>
          </Modal.Footer>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}
