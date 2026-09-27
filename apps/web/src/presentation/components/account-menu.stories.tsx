import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { userEvent, within } from "storybook/test";
import { AccountMenu, type AccountMenuItem } from "./account-menu";

const ITEMS: readonly AccountMenuItem[] = [
  { label: "Mi perfil", href: "/profile" },
  { label: "Cerrar sesión", onSelect: () => undefined }
];

const meta = {
  title: "Navegación/AccountMenu",
  component: AccountMenu,
  args: { name: "Lucía Fernández", subtitle: "Inversor", items: ITEMS }
} satisfies Meta<typeof AccountMenu>;

export default meta;

type Story = StoryObj<typeof meta>;

/** Account identity and caller-owned session actions. */
export const Default: Story = {};

export const NoSubtitle: Story = {
  args: { name: "Lucía Fernández", items: ITEMS }
};

/** The shared Avatar falls back to initials after this deliberately invalid source fails. */
export const ImageFallback: Story = {
  args: { avatarSrc: "https://example.invalid/lucia.png" }
};

export const LongName: Story = {
  args: { name: "Lucía Fernández de la Fuente y Martínez", subtitle: "Inversor" }
};

/** Opens through the same native trigger a person uses, so the panel is visible in Canvas. */
export const Open: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: /Lucía Fernández/ }));
  }
};
