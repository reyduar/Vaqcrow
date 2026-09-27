import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Timeline, type TimelineStep } from "./timeline";

/**
 * Timeline: the "Recorrido de la demo" step list from `Vaqcrow
 * Sistema.dc.html`. Vertical only — see the module doc in `timeline.tsx` for
 * why the template's horizontal stepper variant was not added in this task.
 */
const demoSteps: readonly TimelineStep[] = [
  {
    label: "Solicitud recibida",
    description: "Perfil, KYC y ventas guardados con su origen.",
    state: "done"
  },
  {
    label: "Evaluación de IA",
    description: "Organiza la evidencia, marca faltantes y anomalías y propone una banda de riesgo.",
    state: "current"
  },
  {
    label: "Decisión humana",
    description: "Una persona revisa y registra la decisión, con razón y fecha.",
    state: "pending"
  },
  {
    label: "Apertura de la bóveda",
    description: "Si se aprueba, se abre la bóveda en Testnet y se firma con Freighter.",
    state: "pending"
  }
];

const meta = {
  title: "Datos/Timeline",
  component: Timeline,
  args: { steps: demoSteps }
} satisfies Meta<typeof Timeline>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const AllDone: Story = {
  args: {
    steps: demoSteps.map((step) => ({ ...step, state: "done" as const }))
  }
};

export const WithoutDescriptions: Story = {
  args: {
    steps: demoSteps.map(({ label, state }) => ({ label, state }))
  }
};
