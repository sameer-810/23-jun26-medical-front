/**
 * Rewrites `import { Menu } from "lucide-react-native"` to import that one icon.
 *
 * The package's entry re-exports all 1,700+ icons, and Metro keeps every module
 * it can reach, so one icon on the login screen shipped 1.2 MB of them to every
 * browser and phone. Expo's own tree shaking removes them too, but it is flagged
 * unstable and takes a build from 12 s to about 150 s; this does just the one
 * job, and leaves module semantics alone.
 *
 * The name -> file table is read from the package itself, so an alias
 * (`MenuIcon`, `LucideMenu`) and a future version both resolve correctly. Any
 * import it doesn't recognise stays as written, which still works: it is only
 * bigger. Pairs with the `lucide-icon/` resolver in metro.config.js, because the
 * package's `exports` map doesn't list individual icons.
 */
const fs = require("fs");
const path = require("path");

const LUCIDE = "lucide-react-native";
const ENTRY = path.join(
  path.dirname(path.dirname(require.resolve(LUCIDE))),
  "esm/lucide-react-native.mjs",
);

function iconFiles() {
  const files = new Map();
  const statement = /export \{([^}]*)\} from '\.\/icons\/([^']+)\.mjs';/g;
  const source = fs.readFileSync(ENTRY, "utf8");
  for (const [, names, file] of source.matchAll(statement)) {
    for (const part of names.split(",")) {
      const name = part.trim().split(" as ")[1];
      if (name) files.set(name.trim(), file);
    }
  }
  return files;
}

module.exports = function lucideImports({ types: t }) {
  const files = iconFiles();
  return {
    name: "lucide-imports",
    visitor: {
      ImportDeclaration(nodePath) {
        const { node } = nodePath;
        if (node.source.value !== LUCIDE || node.importKind === "type") return;
        const direct = [];
        const kept = [];
        for (const spec of node.specifiers) {
          const name = spec.imported?.name;
          const file = spec.importKind !== "type" && files.get(name);
          if (file) direct.push([spec.local.name, file]);
          else kept.push(spec);
        }
        if (!direct.length) return;
        const imports = direct.map(([local, file]) =>
          t.importDeclaration(
            [t.importDefaultSpecifier(t.identifier(local))],
            t.stringLiteral(`lucide-icon/${file}`),
          ),
        );
        if (kept.length) {
          node.specifiers = kept;
          nodePath.insertBefore(imports);
        } else {
          nodePath.replaceWithMultiple(imports);
        }
      },
    },
  };
};
