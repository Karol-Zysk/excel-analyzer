type XmlPrimitive = string | number | boolean;

export type XmlNode = {
  name: string;
  attrs?: Record<string, string | undefined>;
  children?: Array<XmlNode | XmlPrimitive | null | undefined>;
};

function escapeXml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function renderNode(node: XmlNode, indent = ""): string {
  const attrs = Object.entries(node.attrs ?? {})
    .filter(([, value]) => value !== undefined)
    .map(([key, value]) => ` ${key}="${escapeXml(String(value))}"`)
    .join("");

  const children = (node.children ?? []).filter((child) => child !== null && child !== undefined);
  if (children.length === 0) {
    return `${indent}<${node.name}${attrs}/>`;
  }

  if (children.every((child) => typeof child !== "object")) {
    const textContent = children.map((child) => escapeXml(String(child))).join("");
    return `${indent}<${node.name}${attrs}>${textContent}</${node.name}>`;
  }

  const renderedChildren = children.map((child) => {
    if (typeof child === "object") {
      return renderNode(child, `${indent}  `);
    }

    return `${indent}  ${escapeXml(String(child))}`;
  });

  return [`${indent}<${node.name}${attrs}>`, ...renderedChildren, `${indent}</${node.name}>`].join("\n");
}

export function createNode(
  name: string,
  children?: Array<XmlNode | XmlPrimitive | null | undefined>,
  attrs?: Record<string, string | undefined>
): XmlNode {
  return {
    name,
    attrs,
    children
  };
}

export function renderXmlDocument(root: XmlNode) {
  return `<?xml version="1.0" encoding="UTF-8"?>\n${renderNode(root)}\n`;
}
