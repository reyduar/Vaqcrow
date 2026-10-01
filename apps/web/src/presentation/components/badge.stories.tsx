import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { IoCheckmarkCircleOutline } from "react-icons/io5";
import { Badge, type BadgeProps } from "./badge";

/**
 * `Badge` is the trust badge primitive. `BadgeTone` now includes an adopted
 * "success" tone (template `--ok-s`/`--ok-t`), but it is bounded by
 * `demo-ui.md` §2: no variant defaults to it, so a transaction in
 * "Enviada"/"Pendiente de confirmación" cannot read as success, and success is
 * only ever selected explicitly for a ledger-confirmed result.
 *
 * Every story renders visible text: meaning never lives in colour or icon
 * alone (the project's accessibility rule for statuses).
 */
const meta = {
  title: "Primitivas/Badge",
  component: Badge,
  args: { variant: "testnet", label: "TESTNET · Activos sin valor económico", lang: "es" }
} satisfies Meta<typeof Badge>;

export default meta;

type Story = StoryObj<typeof meta>;

/** The four badge families with their default tone, as used across the demo. */
const FAMILIES: readonly BadgeProps[] = [
  { variant: "testnet", label: "TESTNET · Activos sin valor económico" },
  { variant: "simulado", label: "SIMULADO" },
  { variant: "demo", label: "DEMO" },
  { variant: "risk", label: "Riesgo medio" },
  { variant: "transaction", label: "Pendiente de confirmación" },
  { variant: "evidence", label: "Evidencia sintética" },
  { variant: "fallback", label: "Respuesta de respaldo" }
];

export const Families: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-2">
      {FAMILIES.map((props) => (
        <Badge key={props.variant} {...props} lang="es" />
      ))}
    </div>
  )
};

export const NetworkAndSimulation: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-2">
      <Badge variant="demo" label="DEMO" lang="es" />
      <Badge variant="testnet" label="TESTNET · Activos sin valor económico" lang="es" />
      <Badge variant="simulado" label="SIMULADO" lang="es" />
    </div>
  )
};

/**
 * Pending is not confirmed: the neutral tone plus text, never a success
 * treatment. This story exists so the rule is reviewable at a glance.
 */
export const PendingIsNotConfirmed: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-2">
      <Badge variant="transaction" label="Enviado" lang="es" />
      <Badge variant="transaction" label="Pendiente de confirmación" lang="es" />
    </div>
  )
};

export const Simulado: Story = { args: { variant: "simulado", label: "SIMULADO" } };

/**
 * The adopted success tone, opt-in and only for a ledger-confirmed outcome.
 * The tone travels with icon and text; it is never the only signal.
 */
export const Confirmed: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-2">
      <Badge variant="transaction" tone="success" label="Confirmada" icon={IoCheckmarkCircleOutline} lang="es" />
    </div>
  )
};
