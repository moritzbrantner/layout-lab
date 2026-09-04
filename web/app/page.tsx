import {CompositingDepth} from "@/components/CompositingDepth";
import {GridDepth} from "@/components/GridDepth";
import {LayoutLab} from "@/components/LayoutLab";
import {LayoutWorkbench} from "@/components/LayoutWorkbench";
import {SizingDepth} from "@/components/SizingDepth";
import {ThreeDDepth} from "@/components/ThreeDDepth";

export default function Home() {
  return (
    <>
      <LayoutWorkbench />
      <LayoutLab />
      <SizingDepth />
      <GridDepth />
      <ThreeDDepth />
      <CompositingDepth />
    </>
  );
}
