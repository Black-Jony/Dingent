import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { WorkflowCanvas } from "./WorkflowCanvas";

type MockNode = { id: string; data: { name: string } };
type MockWorkflow = {
  id: string;
  name: string;
  nodes?: MockNode[];
  edges?: unknown[];
};

const controls = vi.hoisted(() => ({
  data: { id: "workflow-1", name: "Summary" } as MockWorkflow,
  placeholder: true,
  setUsedAssistantIds: vi.fn(),
}));
vi.mock("next/navigation", () => ({ useParams: () => ({ slug: "alpha" }) }));
vi.mock("@/lib/api/client", () => ({
  getClientApi: () => ({ forWorkspace: () => ({ workflows: {} }) }),
}));
vi.mock("../hooks", () => ({
  useWorkflow: () => ({
    data: controls.data,
    isLoading: false,
    isError: false,
    isPlaceholderData: controls.placeholder,
    refetch: vi.fn(),
  }),
}));
vi.mock("../providers", () => ({
  useWorkflowContext: () => ({
    draggedAssistant: null,
    setUsedAssistantIds: controls.setUsedAssistantIds,
  }),
}));
vi.mock("../hooks/useFlowLogic", () => ({
  useFlowLogic: (_nodes: unknown, setNodes: (nodes: unknown[]) => void) => ({
    onNodesChange: () =>
      setNodes([{ id: "draft", data: { name: "Unsaved draft" } }]),
  }),
}));
vi.mock("../components/nodes", () => ({ nodeTypes: {} }));
vi.mock("../components/edges", () => ({ edgeTypes: {} }));
vi.mock("@xyflow/react", () => ({
  ReactFlowProvider: ({ children }: { children: React.ReactNode }) => children,
  ReactFlow: ({
    nodes,
    onNodesChange,
  }: {
    nodes: MockNode[];
    onNodesChange: () => void;
  }) => (
    <div>
      <output>{nodes.map((node) => node.data.name).join(",")}</output>
      <button onClick={onNodesChange}>Edit graph</button>
    </div>
  ),
  Background: () => null,
  Controls: () => null,
}));
afterEach(cleanup);

it("hydrates from complete details rather than a list placeholder, and protects edits on refetch", () => {
  controls.placeholder = true;
  controls.data = { id: "workflow-1", name: "Summary" };
  const view = render(
    <WorkflowCanvas
      workflowId="workflow-1"
      onSave={vi.fn()}
      isSaving={false}
    />,
  );
  expect(
    screen.queryByRole("button", { name: "Save Workflow" }),
  ).not.toBeInTheDocument();
  controls.placeholder = false;
  controls.data = {
    id: "workflow-1",
    name: "Details",
    nodes: [{ id: "node-1", data: { name: "Loaded node" } }],
    edges: [],
  };
  view.rerender(
    <WorkflowCanvas
      workflowId="workflow-1"
      onSave={vi.fn()}
      isSaving={false}
    />,
  );
  expect(screen.getByText("Loaded node")).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "Edit graph" }));
  controls.data = {
    ...controls.data,
    nodes: [{ id: "node-1", data: { name: "Background refetch" } }],
  };
  view.rerender(
    <WorkflowCanvas
      workflowId="workflow-1"
      onSave={vi.fn()}
      isSaving={false}
    />,
  );
  expect(screen.getByText("Unsaved draft")).toBeVisible();
  expect(screen.queryByText("Background refetch")).not.toBeInTheDocument();
});
