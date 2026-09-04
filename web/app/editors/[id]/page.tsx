import {notFound} from "next/navigation";
import {CompositingDepth} from "@/components/CompositingDepth";
import {EditorPageHeader} from "@/components/EditorNavigation";
import {GridDepth} from "@/components/GridDepth";
import {LayoutLab} from "@/components/LayoutLab";
import {SizingDepth} from "@/components/SizingDepth";
import {ThreeDDepth} from "@/components/ThreeDDepth";
import {editorCollectionById, type EditorCollection as EditorCollectionName} from "@/lib/editor-pages";
import {experiments, type Experiment} from "@/lib/experiments";

export const dynamicParams = false;

export function generateStaticParams() {
  return experiments.map((experiment) => ({id: experiment.id}));
}

function EditorCollection({collection}: {collection: EditorCollectionName}) {
  if (collection === "foundation") return <LayoutLab />;
  if (collection === "sizing") return <SizingDepth />;
  if (collection === "grid") return <GridDepth />;
  if (collection === "three-d") return <ThreeDDepth />;
  return <CompositingDepth />;
}

export default async function ExperimentPage({params}: {params: Promise<{id: string}>}) {
  const {id} = await params;
  const experiment = experiments.find((candidate) => candidate.id === id);
  if (!experiment) notFound();

  const experimentId = experiment.id as Experiment["id"];
  return (
    <div className="editor-page-shell">
      <EditorPageHeader
        current={experimentId}
        area={experiment.area}
        title={experiment.title}
        summary={experiment.summary}
      />
      <div className="single-editor-selection" data-editor={experimentId}>
        <EditorCollection collection={editorCollectionById[experimentId]} />
      </div>
    </div>
  );
}
