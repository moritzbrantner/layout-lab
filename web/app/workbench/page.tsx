import {EditorPageHeader} from "@/components/EditorNavigation";
import {LayoutWorkbench} from "@/components/LayoutWorkbench";

export default function WorkbenchPage() {
  return (
    <div className="editor-page-shell">
      <EditorPageHeader
        current="workbench"
        area="2D + 3D"
        title="Object workbench"
        summary="Edit one layout tree in place: select the root or an object, reveal its controls inside the element, then hide all controls to inspect the resolved geometry cleanly."
      />
      <LayoutWorkbench />
    </div>
  );
}
