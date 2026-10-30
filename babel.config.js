module.exports = function (api) {
  api.cache(true);
  return {
    presets: ["babel-preset-expo"],
    plugins: [
      "./plugins/babelLucideImports",
      [
        "module-resolver",
        {
          root: ["./"],
          alias: {
            "@": "./",
            "@api": "./src/shared/api",
            "@modules": "./src/modules",
            "@navigation": "./src/navigation",
            "@shared": "./src/shared",
            "@config": "./src/config",
          },
          extensions: [".js", ".jsx", ".ts", ".tsx"],
        },
      ],
      "react-native-worklets/plugin",
    ],
  };
};
