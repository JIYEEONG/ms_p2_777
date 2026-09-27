const fs = require("node:fs");
const acorn = require("../front/node_modules/acorn");

const file = process.argv[2];
const source = fs.readFileSync(file, "utf8");
const results = [];

function parse(code, offset = 0) {
  const tree = acorn.parse(code, { ecmaVersion: "latest", sourceType: "module" });
  function walk(node) {
    if (!node || typeof node !== "object") return;
    if (node.type === "CallExpression" && /^(text|taxiText|taxiMapText)$/.test(node.callee.name || "")) {
      const [ko, en] = node.arguments;
      if (typeof ko?.value === "string" && typeof en?.value === "string") {
        results.push({ text: ko.value, english: en.value, position: offset + node.start });
      }
    }
    if (node.type === "Literal" && typeof node.value === "string") {
      results.push({ text: node.value, position: offset + node.start });
    } else if (node.type === "TemplateLiteral") {
      const text = node.quasis.map((q, index) => {
        const expression = node.expressions[index];
        const icon = expression?.type === "CallExpression" && expression.callee.name === "icon";
        return (q.value.cooked ?? q.value.raw) + (expression && !icon ? "${value}" : "");
      }).join("");
      results.push({ text, position: offset + node.start });
    }
    for (const [key, value] of Object.entries(node)) {
      if (key === "start" || key === "end" || key === "loc") continue;
      if (Array.isArray(value)) value.forEach(walk);
      else if (value && typeof value === "object") walk(value);
    }
  }
  walk(tree);
}

if (file.endsWith(".html")) {
  const scripts = /<script\b[^>]*>([\s\S]*?)<\/script>/gi;
  for (const match of source.matchAll(scripts)) {
    if (match[1].trim()) parse(match[1], match.index + match[0].indexOf(match[1]));
  }
} else {
  parse(source);
}

process.stdout.write(JSON.stringify(results));
