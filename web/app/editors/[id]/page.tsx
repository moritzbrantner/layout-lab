import {notFound} from "next/navigation";
import {CompositingDepth} from "@/components/CompositingDepth";
import {EditorPageHeader} from "@/components/EditorNavigation";
import {GridDepth} from "@/components/GridDepth";
import {LayoutLab} from "@/components/LayoutLab";
import {SizingDepth} from "@/components/SizingDepth";
import {ThreeDDepth} from "@/components/ThreeDDepth";
import {experiments, type Experiment} from "@/lib/experiments";

export const dynamicParams = false;

export function generateStaticParams() {
  return experiments.map((experiment) => ({id: experiment.id}));
}

const foundationEditors = new Set<Experiment["id"]>([
  "flex",
  "grid",
  "intrinsic-sizing",
  "positioning",
  "transforms-3d",
]);

const sizingEditors = new Set<Experiment["id"]>([
  "flex-freezing",
  "grid-track-sizing",
]);

const gridEditors = new Set<Experiment["id"]>([
  "grid-intrinsic",
  "grid-auto-repeat",
]);

const threeDEditors = new Set<Experiment["id"]>([
  "origins-3d",
  "context-3d",
]);

const compositingEditors = new Set<Experiment["id"]>([
  "stacking-contexts",
  "hit-testing",
]);

function EditorCollection({id}: {id: Experiment["id"]}) {
  if (foundationEditors.has(id)) return <LayoutLab />;
  if (sizingEditors.has(id)) return <SizingDepth />;
  if (gridEditors.has(id)) return <GridDepth />;
  if (threeDEditors.has(id)) return <ThreeDDepth />;
  if (compositingEditors.has(id)) return <CompositingDepth />;
  return null;
}

export default async function ExperimentPage({params}: {params: Promise<{id: string}>}) {
  const {id} = await params;
  const experiment = experiments.find((candidate) => candidate.id === id);
  if (!experiment) notFound();

  return (
    <div className="editor-page-shell">
      <EditorPageHeader
        current={experiment.id}
        area={experiment.area}
        title={experiment.title}
        summary={experiment.summary}
      />
      <div className="single-editor-selection" data-editor={experiment.id}>
        <EditorCollection id={experiment.id} />
      </div>
    </div>
  );
}
