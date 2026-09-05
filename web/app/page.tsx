import Link from "next/link";
import {experiments} from "@/lib/experiments";

export default function Home() {
  return (
    <main className="editor-index-page">
      <section className="editor-index-intro">
        <div className="eyebrow">layout lab</div>
        <h1>Choose one editor.</h1>
        <p>
          Each layout experiment now has its own page so the controls, explanation, and viewport can stay focused on one layout problem at a time.
        </p>
      </section>

      <nav className="editor-directory" aria-label="Layout Lab editor directory">
        <Link href="/workbench">
          <strong>Object workbench</strong>
          <span>Build one object tree, edit properties directly inside its elements, and switch between 2D and 3D views.</span>
        </Link>
        <Link href="/grid-3d">
          <strong>3D Grid</strong>
          <span>Codify boxes with CSS Grid-like columns, rows, layers, gaps, and spans, then inspect the resolved spatial layout.</span>
        </Link>
        <Link href="/website">
          <strong>Website rearranger</strong>
          <span>Import an inert website snapshot, block its own interactions, and drag visible DOM elements into new positions.</span>
        </Link>
        {experiments.map((experiment) => (
          <Link key={experiment.id} href={`/editors/${experiment.id}`}>
            <strong>{experiment.title}</strong>
            <span>{experiment.summary}</span>
          </Link>
        ))}
      </nav>
    </main>
  );
}
