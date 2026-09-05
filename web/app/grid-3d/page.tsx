import {EditorPageHeader} from "@/components/EditorNavigation";
import {Grid3DEditor} from "@/components/Grid3DEditor";

export default function Grid3DPage() {
  return (
    <div className="editor-page-shell grid3d-page-shell">
      <EditorPageHeader
        current="grid-3d"
        area="Spatial layout"
        title="3D Grid"
        summary="Arrange boxes with CSS Grid-like columns, rows, layers, gaps, and spans, then inspect the resolved spatial geometry in a dedicated 3D viewer."
      />
      <Grid3DEditor />
    </div>
  );
}
