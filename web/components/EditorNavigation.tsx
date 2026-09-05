import Link from "next/link";
import {experiments} from "@/lib/experiments";

export function EditorNavigation({current}: {current?: string}) {
  return (
    <nav className="editor-navigation" aria-label="Layout Lab editors">
      <Link href="/" className="editor-navigation-home">All editors</Link>
      <Link href="/workbench" aria-current={current === "workbench" ? "page" : undefined}>Workbench</Link>
      <Link href="/website" aria-current={current === "website" ? "page" : undefined}>Website</Link>
      {experiments.map((experiment) => (
        <Link
          key={experiment.id}
          href={`/editors/${experiment.id}`}
          aria-current={current === experiment.id ? "page" : undefined}
        >
          {experiment.title}
        </Link>
      ))}
    </nav>
  );
}

export function EditorPageHeader({
  current,
  title,
  summary,
  area,
}: {
  current: string;
  title: string;
  summary: string;
  area: string;
}) {
  return (
    <header className="editor-page-header">
      <EditorNavigation current={current} />
      <div className="editor-page-heading">
        <div className="eyebrow">{area} editor</div>
        <h1>{title}</h1>
        <p>{summary}</p>
      </div>
    </header>
  );
}
