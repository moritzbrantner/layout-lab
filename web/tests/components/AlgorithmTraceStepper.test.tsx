import {describe, expect, test} from "bun:test";
import {renderToStaticMarkup} from "react-dom/server";
import {AlgorithmTraceStepper} from "../../components/AlgorithmTraceStepper";

const trace = [
  {id: "first", label: "First decision", summary: "Inspect the first intermediate state."},
  {id: "second", label: "Second decision", summary: "Inspect the second intermediate state."},
  {id: "third", label: "Third decision", summary: "Inspect the third intermediate state."},
] as const;

describe("AlgorithmTraceStepper", () => {
  test("renders the selected common trace step with phase navigation", () => {
    const markup = renderToStaticMarkup(
      <AlgorithmTraceStepper trace={trace} activeStep={1} onStepChange={() => {}} />,
    );

    expect(markup).toContain("Shared step-through");
    expect(markup).toContain("Step 2 of 3");
    expect(markup).toContain("Second decision");
    expect(markup).toContain("Inspect the second intermediate state.");
    expect(markup).toContain('aria-pressed="true"><span>2</span>Second decision');
    expect(markup).toContain("Previous step");
    expect(markup).toContain("Next step");
  });

  test("clamps an out-of-range selected step to the last trace entry", () => {
    const markup = renderToStaticMarkup(
      <AlgorithmTraceStepper trace={trace} activeStep={99} onStepChange={() => {}} />,
    );

    expect(markup).toContain("Step 3 of 3");
    expect(markup).toContain("Third decision");
    expect(markup).toContain('<button type="button" disabled="">Next step</button>');
  });

  test("disables previous navigation on the first step", () => {
    const markup = renderToStaticMarkup(
      <AlgorithmTraceStepper trace={trace} activeStep={0} onStepChange={() => {}} />,
    );

    expect(markup).toContain('<button type="button" disabled="">Previous step</button>');
    expect(markup).toContain("Step 1 of 3");
  });

  test("renders an explicit empty-state boundary for algorithms without trace entries", () => {
    const markup = renderToStaticMarkup(
      <AlgorithmTraceStepper trace={[]} activeStep={0} onStepChange={() => {}} />,
    );

    expect(markup).toContain("Shared step-through");
    expect(markup).toContain("No intermediate trace steps for this fixture.");
  });
});
