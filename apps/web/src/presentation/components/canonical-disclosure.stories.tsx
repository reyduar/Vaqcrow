import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { disclosures, type DisclosureId } from "@/application/trust/disclosures";
import { CanonicalDisclosure } from "./canonical-disclosure";

/**
 * The six canonical disclosures, rendered verbatim. A consistency test asserts
 * the same texts appear verbatim in `DEMO.md`, `demo-ui.md` and the design
 * brief, so this story doubles as the visual read of that invariant.
 */
const ALL_IDS = Object.keys(disclosures) as DisclosureId[];

const meta = {
  title: "Primitivas/CanonicalDisclosure",
  component: CanonicalDisclosure,
  args: { id: "simulation" satisfies DisclosureId, lang: "es" },
  argTypes: {
    id: { control: "select", options: ALL_IDS }
  }
} satisfies Meta<typeof CanonicalDisclosure>;

export default meta;

type Story = StoryObj<typeof meta>;

export const All: Story = {
  render: () => (
    <div className="flex flex-col gap-3">
      {ALL_IDS.map((id) => (
        <CanonicalDisclosure key={id} id={id} lang="es" />
      ))}
    </div>
  )
};

export const Custody: Story = { args: { id: "contract-custody" satisfies DisclosureId } };

export const NotFitForProduction: Story = { args: { id: "no-production" satisfies DisclosureId } };
