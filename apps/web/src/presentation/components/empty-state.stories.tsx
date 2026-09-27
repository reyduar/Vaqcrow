import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { IoFileTrayOutline } from "react-icons/io5";
import { EmptyState } from "./empty-state";

/**
 * EmptyState primitive. Matches `Explorar PyMEs`' "sin resultados" panel:
 * title, body and a "Limpiar filtros" action rendered through the shared
 * `Button`. The icon, when present, is purely decorative.
 */
const meta = {
  title: "Estados/EmptyState",
  component: EmptyState,
  args: {
    title: "Sin campañas para estos filtros",
    body: "Probá con otro sector, perfil de riesgo o ciudad."
  }
} satisfies Meta<typeof EmptyState>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Basic: Story = {};

export const WithAction: Story = {
  args: {
    action: { label: "Limpiar filtros", onPress: () => {} }
  }
};

export const WithIconAndAction: Story = {
  args: {
    icon: IoFileTrayOutline,
    action: { label: "Limpiar filtros", onPress: () => {} }
  }
};
