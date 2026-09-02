const mode = document.querySelector("#layout-mode");
const width = document.querySelector("#container-width");
const gap = document.querySelector("#gap");
const wrap = document.querySelector("#wrap");
const stage = document.querySelector("#layout-stage");
const widthOutput = document.querySelector("#width-output");
const gapOutput = document.querySelector("#gap-output");
const rulerWidth = document.querySelector("#ruler-width");
const algorithmOutput = document.querySelector("#algorithm-output");
const measureOutput = document.querySelector("#measure-output");
const rowsOutput = document.querySelector("#rows-output");

if (
  !(mode instanceof HTMLSelectElement) ||
  !(width instanceof HTMLInputElement) ||
  !(gap instanceof HTMLInputElement) ||
  !(wrap instanceof HTMLInputElement) ||
  !(stage instanceof HTMLElement) ||
  !(widthOutput instanceof HTMLOutputElement) ||
  !(gapOutput instanceof HTMLOutputElement) ||
  !(rulerWidth instanceof HTMLElement) ||
  !(algorithmOutput instanceof HTMLElement) ||
  !(measureOutput instanceof HTMLElement) ||
  !(rowsOutput instanceof HTMLElement)
) {
  throw new Error("Layout Lab markup is incomplete.");
}

const algorithmNames = {
  flow: "Normal block flow",
  flex: "Flex formatting context",
  grid: "Grid formatting context",
};

function measureRows() {
  const boxes = [...stage.querySelectorAll(".box")];
  const rowStarts = new Set(boxes.map((box) => Math.round(box.getBoundingClientRect().top)));
  const bounds = stage.getBoundingClientRect();

  measureOutput.textContent = `${Math.round(bounds.width)} × ${Math.round(bounds.height)} px`;
  rowsOutput.textContent = String(rowStarts.size);
}

function render() {
  const widthValue = Number(width.value);
  const gapValue = Number(gap.value);
  const modeValue = mode.value;

  stage.dataset.mode = modeValue;
  stage.style.width = `${widthValue}px`;
  stage.style.setProperty("--gap", `${gapValue}px`);
  stage.style.setProperty("--wrap", wrap.checked ? "wrap" : "nowrap");

  widthOutput.value = String(widthValue);
  gapOutput.value = String(gapValue);
  rulerWidth.textContent = `${widthValue} px available`;
  algorithmOutput.textContent = algorithmNames[modeValue] ?? modeValue;
  wrap.disabled = modeValue !== "flex";

  requestAnimationFrame(measureRows);
}

for (const control of [mode, width, gap, wrap]) {
  control.addEventListener("input", render);
  control.addEventListener("change", render);
}

window.addEventListener("resize", measureRows);
render();
