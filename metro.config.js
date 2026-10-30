const path = require("path");
const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

/**
 * `lucide-icon/<name>` is what plugins/babelLucideImports.js rewrites an icon
 * import to: one file, by path, since the package's `exports` map has no entry
 * for a single icon.
 */
const ICONS = path.join(
  path.dirname(path.dirname(require.resolve("lucide-react-native"))),
  "esm/icons",
);
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName.startsWith("lucide-icon/")) {
    return {
      type: "sourceFile",
      filePath: path.join(ICONS, `${moduleName.slice(12)}.mjs`),
    };
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
