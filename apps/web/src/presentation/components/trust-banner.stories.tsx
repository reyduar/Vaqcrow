import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { microcopy } from "@/application/trust/disclosures";
import { TrustBanner } from "./trust-banner";

/**
 * Disclosure banners. The body is never truncated, and no variant selects a
 * success state: `simulation`/`testnet` are neutral notes, `fallback` warns,
 * `error` alerts.
 */
const meta = {
  title: "Primitivas/TrustBanner",
  component: TrustBanner,
  args: {
    variant: "simulation",
    title: "Demostración con datos simulados",
    body: "El KYC/KYB, el historial de ventas y la conversión ARS/activo Stellar son simulados.",
    lang: "es"
  }
} satisfies Meta<typeof TrustBanner>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Simulation: Story = {};

export const Testnet: Story = {
  args: {
    variant: "testnet",
    title: "Stellar Testnet",
    body: "Las transacciones mostradas usan activos sin valor económico en Stellar Testnet."
  }
};

/** With a badge: the composition used by `CanonicalDisclosure`. */
export const WithBadge: Story = {
  args: {
    variant: "simulation",
    title: "Simulación",
    body: "Dato sintético para demostración.",
    badge: { variant: "simulado", label: "SIMULADO", lang: "es" }
  }
};

/** The AI fallback state: it warns and says plainly that it is not a live call. */
export const AiFallback: Story = {
  args: {
    variant: "fallback",
    title: "Respuesta de respaldo",
    body: microcopy.aiFallback,
    badge: { variant: "fallback", label: "RESPUESTA DE RESPALDO", lang: "es" }
  }
};

/** `error` is the only variant that renders `role="alert"`. */
export const Error: Story = {
  args: {
    variant: "error",
    title: "No se pudo consultar la red",
    body: "El error se muestra sanitizado y conserva el reintento disponible."
  }
};
