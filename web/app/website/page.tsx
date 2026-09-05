import {EditorPageHeader} from "@/components/EditorNavigation";
import {WebsiteRearranger} from "@/components/WebsiteRearranger";

export default function WebsitePage() {
  return (
    <div className="editor-page-shell website-page-shell">
      <EditorPageHeader
        current="website"
        area="DOM"
        title="Website rearranger"
        summary="Import an inert snapshot of a website, block its own interaction, and drag visible DOM elements around without changing the source page."
      />
      <WebsiteRearranger />
    </div>
  );
}
