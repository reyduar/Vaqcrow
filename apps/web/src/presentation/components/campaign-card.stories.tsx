import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { CampaignCard } from "./campaign-card";

const SYNTHETIC_GOAL_ARS = 15_000_000;

const formatArs = (value: number, goal: number) =>
  `ARS ${value.toLocaleString("es-AR")} de ARS ${goal.toLocaleString("es-AR")}`;

/**
 * CampaignCard: the campaign/PyME card from the template's "Compuestos"
 * section and `Explorar PyMEs`. Every value is caller-formatted — this
 * component performs no currency, percentage or date arithmetic. The
 * synthetic data below describes the fictional Panadería Horizonte SRL
 * (formerly the journey fixture, retired with #438) plus fictional revenue-share/risk terms consistent with the
 * template's own synthetic campaigns.
 */
const meta = {
  title: "Datos/CampaignCard",
  component: CampaignCard,
  args: {
    smeName: "Panadería Horizonte SRL",
    subtitle: "Panadería y productos de panificación · Córdoba, Argentina",
    raisedLabel: "Progreso de fondeo",
    raisedValue: 9_450_000,
    goal: SYNTHETIC_GOAL_ARS,
    formatRaised: formatArs,
    closeDateLabel: "Cierra el 30/11/2026",
    revenueShareTerms: "4,5 % de ventas",
    riskLevel: "medium",
    riskLabel: "Riesgo medio",
    simuladoLabel: "SIMULADO"
  }
} satisfies Meta<typeof CampaignCard>;

export default meta;

type Story = StoryObj<typeof meta>;

export const InProgress: Story = {};

export const LowRisk: Story = {
  args: { riskLevel: "low", riskLabel: "Riesgo bajo", raisedValue: 7_120_000, goal: 9_500_000 }
};

export const HighRisk: Story = {
  args: { riskLevel: "high", riskLabel: "Riesgo alto", raisedValue: 1_450_000, goal: 12_000_000 }
};

/** Only an explicit, caller-confirmed goal switches the progress bar to the success colour. */
export const GoalReached: Story = {
  args: { raisedValue: SYNTHETIC_GOAL_ARS, isGoalReached: true }
};

export const WithLinkAction: Story = {
  args: {
    action: { label: "Ver evidencia y riesgo", href: "#" }
  }
};

export const WithButtonAction: Story = {
  args: {
    action: { label: "Marcar favorito", onPress: () => {} }
  }
};

export const HeadingLevel2: Story = {
  args: { headingLevel: 2 }
};

export const Grid: Story = {
  render: (args) => (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
      <CampaignCard {...args} />
      <CampaignCard
        {...args}
        smeName="Café Tostadero del Paraná"
        subtitle="Gastronomía · Rosario"
        raisedValue={7_120_000}
        goal={9_500_000}
        riskLevel="low"
        riskLabel="Riesgo bajo"
        revenueShareTerms="3,8 % de ventas"
      />
    </div>
  )
};
