import {VISUAL_FIXTURE_SUITE, visualFixtures, type VisualFixture} from "@/lib/visual-fixtures";

function FlexFixture() {
  return (
    <div className="visual-fixture-canvas fixture-flex" aria-label="Flex free-space distribution fixture">
      <div className="fixture-block fixture-flex-a" aria-label="Flex item A" />
      <div className="fixture-block fixture-flex-b" aria-label="Flex item B" />
      <div className="fixture-block fixture-flex-c" aria-label="Flex item C" />
    </div>
  );
}

function GridFixture() {
  return (
    <div className="visual-fixture-canvas fixture-grid" aria-label="Grid track distribution fixture">
      <div className="fixture-block fixture-grid-a" aria-label="Grid item A" />
      <div className="fixture-block fixture-grid-b" aria-label="Grid item B" />
      <div className="fixture-block fixture-grid-c" aria-label="Grid item C" />
      <div className="fixture-block fixture-grid-d" aria-label="Grid item D" />
    </div>
  );
}

function PositionedFixture() {
  return (
    <div className="visual-fixture-canvas fixture-positioned" aria-label="Positioned transform overlap fixture">
      <div className="fixture-block fixture-positioned-a" aria-label="Positioned item A" />
      <div className="fixture-block fixture-positioned-b" aria-label="Positioned item B" />
      <div className="fixture-block fixture-positioned-c" aria-label="Transformed item C" />
    </div>
  );
}

function FixtureCanvas({fixture}: {fixture: VisualFixture}) {
  if (fixture.id === "flex-free-space") return <FlexFixture />;
  if (fixture.id === "grid-tracks") return <GridFixture />;
  return <PositionedFixture />;
}

export function VisualRegressionFixtures() {
  return (
    <main className="visual-fixtures-page" data-visual-fixture-suite={VISUAL_FIXTURE_SUITE}>
      <header className="visual-fixtures-header">
        <div className="eyebrow">deterministic browser fixtures</div>
        <h1>Visual regression fixtures</h1>
        <p>
          Small, fixed-size browser-native scenes for screenshot or geometry comparison. The canvases avoid text-dependent sizing, animation, randomness, and responsive dimensions.
        </p>
      </header>

      <div className="visual-fixtures-list">
        {visualFixtures.map((fixture) => (
          <article
            key={fixture.id}
            className="visual-fixture"
            data-visual-fixture={fixture.id}
            data-fixture-width={fixture.width}
            data-fixture-height={fixture.height}
          >
            <header>
              <h2>{fixture.title}</h2>
              <p>{fixture.description}</p>
              <code>{fixture.id}</code>
            </header>
            <FixtureCanvas fixture={fixture} />
          </article>
        ))}
      </div>
    </main>
  );
}
