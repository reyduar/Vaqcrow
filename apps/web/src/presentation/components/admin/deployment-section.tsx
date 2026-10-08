"use client";

import { useId, useState, type ReactNode } from "react";
import type { IconType } from "react-icons";
import {
  IoAlertCircleOutline,
  IoCheckmarkCircleOutline,
  IoCubeOutline,
  IoSyncOutline,
  IoTimeOutline
} from "react-icons/io5";
import {
  DEPLOYMENT_COPY,
  deploymentCanDeploy,
  deploymentDetails,
  deploymentPanelVisible,
  deploymentStatusFor
} from "@/application/admin/deployment";
import type {
  AdminDeployment,
  AdminReviewContext,
  AdminReviewPort,
  CampaignDeploymentState
} from "@/application/ports/admin-review-port";
import { useAdminDeployment } from "@/state/use-admin-deployment";
import { Badge } from "../badge";
import { Button } from "../button";

const STATE_ICONS: Readonly<Record<CampaignDeploymentState, IconType>> = {
  pending: IoTimeOutline,
  deploying: IoSyncOutline,
  confirmed: IoCheckmarkCircleOutline,
  failed: IoAlertCircleOutline
};

const TOGGLE_CLASS =
  "inline-flex h-11 items-center rounded-control px-[14px] text-[15px] font-semibold text-text-primary hover:bg-page-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring";

export interface DeploymentSectionProps {
  readonly context: AdminReviewContext;
  readonly reload: () => void;
  readonly port: AdminReviewPort;
  /** Injected in tests; production polls every few seconds while the outcome is open. */
  readonly pollIntervalMs?: number;
}

/**
 * The deployment panel of the admin review (#410 / U6, owner decision D3).
 * The template does not draw it: it sits below the human decision in the
 * narrow column (U2's slot). Hidden unless the review is approved or a
 * deployment record exists. The server deploys after an approval; this panel
 * only reads the persisted lifecycle, polls while it is open, and offers
 * Reintentar when the server reports it retryable (a failure, or an attempt
 * abandoned past its threshold, U8) and Desplegar when nothing is recorded. `Bóveda confirmada / PyME publicada` is the only
 * success-toned state, and every state shows text plus icon.
 */
export function DeploymentSection({ context, reload, port, pollIntervalMs }: DeploymentSectionProps) {
  const ids = useId();
  const deployment = useAdminDeployment(port, context.applicationId, context.state, {
    reload,
    ...(pollIntervalMs === undefined ? {} : { pollIntervalMs })
  });

  if (!deploymentPanelVisible(context.state, deployment.read)) return null;

  const record = deployment.read?.kind === "record" ? deployment.read.deployment : null;

  return (
    <section
      aria-labelledby={`${ids}-title`}
      className="flex flex-col gap-3 rounded-card border border-page-border p-[22px] text-text-primary"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <IoCubeOutline aria-hidden="true" focusable="false" className="text-xl" />
          <h2 id={`${ids}-title`} className="m-0 text-lg font-bold">
            {DEPLOYMENT_COPY.title}
          </h2>
        </div>
        <Badge variant="testnet" label={DEPLOYMENT_COPY.testnet} />
      </div>

      {record ? (
        <DeploymentRecord
          deployment={record}
          detailsId={`${ids}-details`}
          retrying={deployment.retrying}
          onRetry={() => void deployment.retry()}
        />
      ) : deployment.read?.kind === "missing" ? (
        <Unresolved text={DEPLOYMENT_COPY.missing} onRefresh={deployment.refresh}>
          {deploymentCanDeploy(context.state, deployment.read) ? (
            <Button
              onPress={() => void deployment.retry()}
              isLoading={deployment.retrying}
              loadingLabel={DEPLOYMENT_COPY.deploying}
            >
              {DEPLOYMENT_COPY.deploy}
            </Button>
          ) : null}
        </Unresolved>
      ) : deployment.errorCode !== null ? (
        <Unresolved text={DEPLOYMENT_COPY.readError} onRefresh={deployment.refresh} alert />
      ) : (
        <p role="status" className="m-0 text-sm text-text-secondary">
          {DEPLOYMENT_COPY.loading}
        </p>
      )}

      {deployment.message ? (
        <p role="alert" className="m-0 text-sm text-text-primary">
          {deployment.message}
        </p>
      ) : null}
    </section>
  );
}

function DeploymentRecord({
  deployment,
  detailsId,
  retrying,
  onRetry
}: {
  deployment: AdminDeployment;
  detailsId: string;
  retrying: boolean;
  onRetry: () => void;
}) {
  const [open, setOpen] = useState(false);
  const status = deploymentStatusFor(deployment);

  return (
    <>
      <div role="status" className="flex flex-col items-start gap-2">
        <Badge variant="transaction" tone={status.tone} icon={STATE_ICONS[status.icon]} label={status.label} />
        <p className="m-0 text-sm leading-normal">{status.message}</p>
      </div>

      <div className="flex flex-wrap items-center gap-2.5">
        {status.canRetry ? (
          <Button onPress={onRetry} isLoading={retrying} loadingLabel={DEPLOYMENT_COPY.retrying}>
            {DEPLOYMENT_COPY.retry}
          </Button>
        ) : null}
        <button
          type="button"
          aria-expanded={open}
          aria-controls={detailsId}
          onClick={() => setOpen((value) => !value)}
          className={TOGGLE_CLASS}
        >
          {open ? DEPLOYMENT_COPY.hideDetails : DEPLOYMENT_COPY.showDetails}
        </button>
      </div>

      <dl id={detailsId} hidden={!open} className="m-0 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
        {deploymentDetails(deployment).map((detail) => (
          <div key={detail.term} className="contents">
            <dt className="text-text-secondary">{detail.term}</dt>
            <dd className="m-0 break-all">{detail.value}</dd>
          </div>
        ))}
      </dl>
    </>
  );
}

function Unresolved({
  text,
  onRefresh,
  alert = false,
  children
}: {
  text: string;
  onRefresh: () => void;
  alert?: boolean;
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-start gap-2.5">
      <p role={alert ? "alert" : "status"} className="m-0 text-sm leading-normal">
        {text}
      </p>
      <div className="flex flex-wrap items-center gap-2.5">
        {children}
        <Button variant="secondary" onPress={onRefresh}>
          {DEPLOYMENT_COPY.refresh}
        </Button>
      </div>
    </div>
  );
}
