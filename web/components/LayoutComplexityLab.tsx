"use client";

import {runLayoutComplexityLab, type ComplexitySample, type ComplexitySuite} from "@/lib/layout-complexity-lab";

const suiteOrder: readonly ComplexitySuite[] = ["flex", "grid", "constraints", "incremental"];
const suiteTitles: Record<ComplexitySuite, string> = {
  flex: "Flex resolution scaling",
  grid: "Grid track scaling",
  constraints: "Cassowary constraint scaling",
  incremental: "Incremental versus full layout",
};

function values(values: ComplexitySample["dimensions"] | ComplexitySample["counters"]) {
  return values.map((value) => `${value.label}: ${value.value}`).join(" · ");
}

export function LayoutComplexityLab() {
  const result = runLayoutComplexityLab();

  return (
    <section className="layout-complexity" aria-labelledby="layout-complexity-title">
      <div className="algorithm-section-heading">
        <div>
          <div className="eyebrow">H10 complexity laboratory</div>
          <h3 id="layout-complexity-title">Deterministic algorithmic work</h3>
        </div>
        <p>
          This laboratory measures resolver work directly instead of timing the browser. The samples below exclude DOM measurement, rendering, and wall-clock noise and expose the raw counters used for every claim.
        </p>
      </div>

      <div className="layout-complexity-methodology">
        <strong>Methodology · {result.version}</strong>
        <ul>
          {result.methodology.map((line) => <li key={line}>{line}</li>)}
        </ul>
      </div>

      {suiteOrder.map((suite) => {
        const samples = result.samples.filter((sample) => sample.suite === suite);
        return (
          <section className="layout-complexity-suite" key={suite} aria-labelledby={`complexity-${suite}`}>
            <h4 id={`complexity-${suite}`}>{suiteTitles[suite]}</h4>
            <div className="layout-complexity-table-wrap">
              <table>
                <thead>
                  <tr>
                    <th scope="col">Fixture</th>
                    <th scope="col">Scale inputs</th>
                    <th scope="col">Raw deterministic work</th>
                  </tr>
                </thead>
                <tbody>
                  {samples.map((sample) => (
                    <tr key={sample.id}>
                      <th scope="row"><code>{sample.id}</code><span>{sample.title}</span></th>
                      <td>{values(sample.dimensions)}</td>
                      <td>{values(sample.counters)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        );
      })}

      <section className="layout-complexity-pathologies" aria-labelledby="layout-complexity-pathologies-title">
        <h4 id="layout-complexity-pathologies-title">Deliberate near-worst-case fixtures</h4>
        <p>
          These ladders are constructed so exactly one Flex item or Grid track freezes on each pass. For eight elements, that forces eight passes and 36 active-element evaluations.
        </p>
        <div className="layout-complexity-table-wrap">
          <table>
            <thead>
              <tr>
                <th scope="col">Fixture</th>
                <th scope="col">Scale</th>
                <th scope="col">Passes</th>
                <th scope="col">Evaluations</th>
                <th scope="col">Freeze sequence</th>
              </tr>
            </thead>
            <tbody>
              {result.pathologies.map((pathology) => (
                <tr key={pathology.id}>
                  <th scope="row"><code>{pathology.id}</code><span>{pathology.title}</span></th>
                  <td>{pathology.scale}</td>
                  <td>{pathology.passes}</td>
                  <td>{pathology.evaluations}</td>
                  <td>{pathology.freezeSequence.map((frozen) => frozen.length > 0 ? frozen.join(", ") : "accept").join(" → ")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <p className="layout-complexity-boundary">
        H10 deliberately stops short of wall-clock claims. Timing can be added later only with a separate methodology that controls runtime, warmup, host variance, DOM measurement, and rendering costs; the algorithmic counters here remain the stable reference evidence.
      </p>
    </section>
  );
}
