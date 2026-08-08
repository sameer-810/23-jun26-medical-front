/**
 * Expo config plugin — tunes the Android Gradle build for CI:
 *  1. Bumps the Gradle JVM memory (the GitHub runner hits
 *     `OutOfMemoryError: Metaspace` with the default 512 MiB).
 *  2. Builds only the two CPU types real phones use, dropping the
 *     emulator-only x86/x86_64 — roughly halves native C++ compile time.
 *  3. Disables release lint (`lintVitalRelease`) — it is slow, very
 *     memory-hungry, and is NOT needed to produce the .aab. It is the task
 *     that fails under the OOM on a `production` (app-bundle) build, which is
 *     why a preview .apk could succeed while the bundle did not.
 *
 * Re-applied on every `expo prebuild`, so it survives android/ being
 * regenerated during `eas build --local`.
 */
const {
  withAppBuildGradle,
  withGradleProperties,
} = require("@expo/config-plugins");

/** Upsert a gradle.properties key=value pair. */
function setProp(cfg, key, value) {
  const i = cfg.modResults.findIndex(
    (p) => p.type === "property" && p.key === key,
  );
  const item = { type: "property", key, value };
  if (i >= 0) cfg.modResults[i] = item;
  else cfg.modResults.push(item);
}

module.exports = function withAndroidBuildTuning(config) {
  config = withGradleProperties(config, (cfg) => {
    setProp(
      cfg,
      "org.gradle.jvmargs",
      "-Xmx4096m -XX:MaxMetaspaceSize=1024m -Dfile.encoding=UTF-8",
    );
    setProp(cfg, "reactNativeArchitectures", "arm64-v8a,armeabi-v7a");
    return cfg;
  });

  config = withAppBuildGradle(config, (cfg) => {
    let src = cfg.modResults.contents;
    if (!src.includes("checkReleaseBuilds false")) {
      src = src.replace(
        /android\s*\{/,
        `android {
    lint {
        checkReleaseBuilds false
        abortOnError false
    }`,
      );
    }
    cfg.modResults.contents = src;
    return cfg;
  });

  return config;
};
