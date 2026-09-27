import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { IoCubeOutline, IoPeopleOutline } from "react-icons/io5";
import { KpiTile } from "./kpi-tile";

/**
 * KpiTile: a labelled stat tile matching the "Compuestos" KPI cards on
 * `Informes`/`Portafolio`. `value` and `note` are always caller-formatted
 * strings — this component performs no formatting or arithmetic.
 */
const meta = {
  title: "Datos/KpiTile",
  component: KpiTile,
  args: {
    label: "Fondeado",
    value: "ARS 9.450.000",
    note: "de ARS 15.000.000 · cierra el 30/11/2026",
    icon: IoCubeOutline
  }
} satisfies Meta<typeof KpiTile>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithoutNote: Story = {
  render: () => <KpiTile label="Aportantes" value="38" icon={IoPeopleOutline} />
};

export const WithoutIcon: Story = {
  render: () => <KpiTile label="Fondeado" value="ARS 9.450.000" note="de ARS 15.000.000 · cierra el 30/11/2026" />
};

/** Synthetic values carry a SIMULADO badge contiguous to the value, per demo-ui.md §9.3. */
export const Synthetic: Story = {
  args: { simuladoLabel: "SIMULADO" }
};

export const Row: Story = {
  render: () => (
    <div className="grid grid-cols-2 gap-4">
      <KpiTile label="Fondeado" value="ARS 9.450.000" note="de ARS 15.000.000" icon={IoCubeOutline} />
      <KpiTile label="Aportantes" value="38" note="Cuentas de Testnet distintas" icon={IoPeopleOutline} />
    </div>
  )
};
