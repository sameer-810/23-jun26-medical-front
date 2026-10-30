/**
 * A tab must learn a newer build is live, and must never cry wolf when it
 * can't tell: an offline check or a page with no bundle is not an update.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { entryHash, isNewBuild } from "../src/shared/appUpdate";

const page = (hash: string) =>
  `<script src="/_expo/static/js/web/__common-5a693dc3.js"></script><script src="/_expo/static/js/web/index-${hash}.js" defer></script>`;

test("reads the entry bundle, not the common chunk", () => {
  assert.equal(entryHash(page("4e078bb6")), "4e078bb6");
});

test("a different served hash is a new build; the same one isn't", () => {
  assert.equal(isNewBuild("aaa", entryHash(page("bbb"))), true);
  assert.equal(isNewBuild("aaa", entryHash(page("aaa"))), false);
});

test("not knowing is never an update", () => {
  assert.equal(entryHash("<html>offline</html>"), null);
  assert.equal(isNewBuild("aaa", null), false);
  assert.equal(isNewBuild(null, "bbb"), false);
});
