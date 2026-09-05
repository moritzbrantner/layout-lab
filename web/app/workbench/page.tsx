import {EditorPageHeader} from "@/components/EditorNavigation";
import {LayoutWorkbench} from "@/components/LayoutWorkbench";

export default function WorkbenchPage() {
  return (
    <div className="editor-page-shell workbench-page-shell">
      <EditorPageHeader
        current="workbench"
        area="2D + 3D"
        title="Object workbench"
        summary="Build a nested object tree, drag nodes to reorder or reparent them, toggle visibility, and edit the selected node from the dedicated inspector while watching the resolved geometry update."
      />
      <LayoutWorkbench />
    </div>
  );
}
