/**
 * Credentials for the demo pharmacy, read from the environment.
 *
 * These scripts drive a REAL tenant on the live backend, so the password must
 * never sit in the repo — this file exists because it did, in seven places,
 * inside a public GitHub repository. There is deliberately no fallback value:
 * an unset password fails loudly here rather than silently publishing a working
 * login the next time someone greps the source.
 *
 * Usage:  DEMO_PASSWORD=... node tools/verifyBack.mjs
 */
export const DEMO_EMAIL = process.env.DEMO_EMAIL || "admin@medstock.demo";

export const DEMO_PASSWORD = (() => {
  const pw = process.env.DEMO_PASSWORD;
  if (!pw) {
    console.error(
      "\nDEMO_PASSWORD is not set.\n" +
        "These tools sign in to a live pharmacy, so the password is never stored in the repo.\n" +
        "Run with:  DEMO_PASSWORD='<the demo admin password>' node <script>\n",
    );
    process.exit(1);
  }
  return pw;
})();
