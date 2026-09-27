import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { DistributionCalculation } from "./distribution-calculation";

/**
 * The deterministic distribution-calculation block from the template
 * ("Cálculo de distribución · agosto"). Every number is caller-formatted
 * text; the component performs no arithmetic. Deliberately carries no
 * `Badge`/AI styling — it must read as distinct from `AiAssessmentPanel`.
 */
const meta = {
  title: "Confianza/DistributionCalculation",
  component: DistributionCalculation,
  args: {
    heading: "Cálculo de distribución · agosto",
    ruleId: "regla rs-v1.2",
    inputs: [
      { label: "Ventas declaradas · SIMULADO", value: "ARS 3.745.800,00" },
      { label: "Participación", value: "× 4,5 %" }
    ],
    rounding: "2 decimales, al par",
    total: { label: "Distribución calculada", value: "ARS 168.561,00" }
  }
} satisfies Meta<typeof DistributionCalculation>;

export default meta;

type Story = StoryObj<typeof meta>;

export const August: Story = {};

export const AnotherRule: Story = {
  args: {
    heading: "Cálculo de distribución · septiembre",
    ruleId: "regla rs-v1.3",
    inputs: [
      { label: "Ventas declaradas · SIMULADO", value: "ARS 4.102.300,00" },
      { label: "Participación", value: "× 5 %" }
    ],
    rounding: "2 decimales, al par",
    total: { label: "Distribución calculada", value: "ARS 205.115,00" }
  }
};
