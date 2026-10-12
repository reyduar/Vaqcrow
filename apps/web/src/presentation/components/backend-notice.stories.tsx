import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { BackendNotice } from "./backend-notice";

/**
 * BackendNotice primitive. The honest, calm state for a build with no API
 * configured (`NEXT_PUBLIC_API_BASE_URL` unset): `role="status"`, no retry, no
 * danger red. Distinct from `ErrorState`, which is for a genuine failed read.
 */
const meta = {
  title: "Estados/BackendNotice",
  component: BackendNotice
} satisfies Meta<typeof BackendNotice>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Basic: Story = {};
