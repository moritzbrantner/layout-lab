export function normalizeWebsiteUrl(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) {
    throw new Error("Enter a website URL.");
  }

  const candidate = /^[a-zA-Z][a-zA-Z\d+.-]*:/.test(trimmed) ? trimmed : `https://${trimmed}`;
  const url = new URL(candidate);
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Only HTTP and HTTPS websites can be imported.");
  }

  return url.href;
}

export function describeImportedElement(element: Element): string {
  const tag = element.tagName.toLowerCase();
  const id = element.id ? `#${element.id}` : "";
  const classes = Array.from(element.classList)
    .slice(0, 2)
    .map((className) => `.${className}`)
    .join("");

  return `<${tag}${id}${classes}>`;
}

const EDITOR_STYLE = `
html { min-height: 100%; }
html, body { cursor: default; }
*:not(html):not(body) {
  cursor: grab !important;
  user-select: none !important;
}
[data-layout-lab-selected="true"] {
  outline: 2px solid rgb(42 111 255) !important;
  outline-offset: 2px !important;
}
[data-layout-lab-dragging="true"] {
  cursor: grabbing !important;
}
[data-layout-lab-moved="true"] {
  translate: var(--layout-lab-x, 0px) var(--layout-lab-y, 0px) !important;
}
`;

export function prepareImportedHtml(sourceHtml: string, sourceUrl?: string): string {
  const parser = new DOMParser();
  const document = parser.parseFromString(sourceHtml, "text/html");

  document.querySelectorAll("script, noscript, iframe, object, embed, portal").forEach((element) => element.remove());
  document.querySelectorAll('meta[http-equiv]').forEach((element) => {
    const directive = element.getAttribute("http-equiv")?.toLowerCase();
    if (directive === "refresh" || directive === "content-security-policy") {
      element.remove();
    }
  });
  document.querySelectorAll('meta[name="referrer"]').forEach((element) => element.remove());
  document.querySelectorAll("base").forEach((element) => element.remove());

  document.querySelectorAll("*").forEach((element) => {
    for (const attribute of Array.from(element.attributes)) {
      const name = attribute.name.toLowerCase();
      if (name.startsWith("on") || name === "srcdoc") {
        element.removeAttribute(attribute.name);
      }
    }
    element.removeAttribute("autoplay");
  });

  const referrer = document.createElement("meta");
  referrer.name = "referrer";
  referrer.content = "no-referrer";
  document.head.prepend(referrer);

  if (sourceUrl) {
    const base = document.createElement("base");
    base.href = sourceUrl;
    document.head.prepend(base);
  }

  const editorStyle = document.createElement("style");
  editorStyle.dataset.layoutLab = "website-rearranger";
  editorStyle.textContent = EDITOR_STYLE;
  document.head.append(editorStyle);

  return `<!doctype html>\n${document.documentElement.outerHTML}`;
}
