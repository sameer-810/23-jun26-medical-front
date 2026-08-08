/**
 * Expo config plugin — wires a RELEASE signing config into the generated
 * Android project so `./gradlew bundleRelease` produces a Play-ready, signed
 * .aab ON A DEVELOPER MACHINE, without EAS build credits. Re-applied on every
 * `expo prebuild`, so it survives android/ being regenerated.
 *
 * Not needed in CI: `eas build --local` injects the EAS-managed keystore
 * itself, which is why the workflow only needs EXPO_TOKEN. This is for the
 * case where you build the bundle by hand.
 *
 * Secrets are NOT in this (committed) file — they are read from
 * ./credentials/signing.json (gitignored). If that file is missing (a CI
 * checkout, or a machine without the keystore) release builds fall back to
 * debug signing so `expo prebuild` never breaks.
 *
 *   credentials/signing.json
 *   {
 *     "storeFile": "../../credentials/plusveda-upload.keystore",
 *     "storePassword": "…",
 *     "keyAlias": "upload",
 *     "keyPassword": "…"
 *   }
 *
 * `storeFile` is resolved by Gradle from android/app/, hence the ../../.
 */
const fs = require("fs");
const path = require("path");
const {
  withAppBuildGradle,
  withGradleProperties,
} = require("@expo/config-plugins");

function loadSigning() {
  try {
    const file = path.join(__dirname, "..", "credentials", "signing.json");
    const s = JSON.parse(fs.readFileSync(file, "utf8"));
    if (s.storeFile && s.storePassword && s.keyAlias && s.keyPassword) {
      return {
        RELEASE_STORE_FILE: s.storeFile,
        RELEASE_STORE_PASSWORD: s.storePassword,
        RELEASE_KEY_ALIAS: s.keyAlias,
        RELEASE_KEY_PASSWORD: s.keyPassword,
      };
    }
  } catch {
    // no credentials available → skip (debug fallback)
  }
  return null;
}

function withSigningGradleProperties(config, props) {
  return withGradleProperties(config, (cfg) => {
    for (const [key, value] of Object.entries(props)) {
      const i = cfg.modResults.findIndex(
        (p) => p.type === "property" && p.key === key,
      );
      const item = { type: "property", key, value };
      if (i >= 0) cfg.modResults[i] = item;
      else cfg.modResults.push(item);
    }
    return cfg;
  });
}

function withSigningBuildGradle(config) {
  return withAppBuildGradle(config, (cfg) => {
    let src = cfg.modResults.contents;

    // 1. Add a `release` block inside signingConfigs (only once).
    if (
      !src.includes("signingConfigs.release") &&
      /signingConfigs\s*\{/.test(src)
    ) {
      src = src.replace(
        /signingConfigs\s*\{/,
        `signingConfigs {
        release {
            if (project.hasProperty('RELEASE_STORE_FILE')) {
                storeFile file(RELEASE_STORE_FILE)
                storePassword RELEASE_STORE_PASSWORD
                keyAlias RELEASE_KEY_ALIAS
                keyPassword RELEASE_KEY_PASSWORD
            }
        }`,
      );
    }

    // 2. Point the release buildType at it (anchored on the RN comment that
    //    only appears in the release block, so debug isn't touched).
    src = src.replace(
      /(see https:\/\/reactnative\.dev\/docs\/signed-apk-android\.\s*\n\s*)signingConfig signingConfigs\.debug/,
      `$1signingConfig project.hasProperty('RELEASE_STORE_FILE') ? signingConfigs.release : signingConfigs.debug`,
    );

    cfg.modResults.contents = src;
    return cfg;
  });
}

module.exports = function withReleaseSigning(config) {
  const props = loadSigning();
  if (!props) return config; // no keystore → leave debug signing in place
  config = withSigningGradleProperties(config, props);
  config = withSigningBuildGradle(config);
  return config;
};
