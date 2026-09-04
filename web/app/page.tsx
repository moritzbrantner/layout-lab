import {GridDepth} from "@/components/GridDepth";
import {LayoutLab} from "@/components/LayoutLab";
import {SizingDepth} from "@/components/SizingDepth";
import {ThreeDDepth} from "@/components/ThreeDDepth";

export default function Home() {
  return (
    <>
      <LayoutLab />
      <SizingDepth />
      <GridDepth />
      <ThreeDDepth />
    </>
  );
}
