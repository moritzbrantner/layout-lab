import type {Meta, StoryObj} from "@storybook/nextjs-vite";
import {EditorNavigation} from "./EditorNavigation";

const meta = {
  title: "Navigation/EditorNavigation",
  component: EditorNavigation,
  parameters: {
    layout: "padded",
  },
} satisfies Meta<typeof EditorNavigation>;

export default meta;
type Story = StoryObj<typeof meta>;

export const AllEditors: Story = {};

export const WorkbenchCurrent: Story = {
  args: {
    current: "workbench",
  },
};
