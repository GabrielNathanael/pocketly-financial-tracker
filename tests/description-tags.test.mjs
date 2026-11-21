import test from "node:test";
import assert from "node:assert/strict";
import {
  findBracketTag,
  stripBracketTag,
  stripSystemTags,
} from "../src/lib/utils/bracket-tags.ts";

const SPLIT_ITEM_DESC =
  "Patungan - tes [Items: tes2 (Rp 25.000) [÷3, mine Rp 8.334], tes (Rp 9.000)]";

test("findBracketTag handles nested brackets from split-bill portions", () => {
  const tag = findBracketTag(SPLIT_ITEM_DESC, "Items");
  assert.ok(tag);
  assert.equal(
    tag.inner,
    "tes2 (Rp 25.000) [÷3, mine Rp 8.334], tes (Rp 9.000)",
  );
  assert.equal(tag.full.endsWith("tes (Rp 9.000)]"), true);
});

test("stripSystemTags does not leave a dangling ']' fragment (regression)", () => {
  const naive = SPLIT_ITEM_DESC.replace(/\[Items:\s*[^\]]+\]/g, "").trim();
  assert.equal(naive.includes("]"), true); // documents the old broken behavior

  assert.equal(stripSystemTags(SPLIT_ITEM_DESC), "Patungan - tes");
});

test("multiple system tags are all stripped, memo can still be extracted", () => {
  const desc =
    "Belanja [Memo: Stok dapur] [Items: Beras (Rp 75.000) [÷2, mine Rp 37.500]]";
  assert.equal(stripSystemTags(desc), "Belanja");
  assert.equal(findBracketTag(desc, "Memo")?.inner, "Stok dapur");
  assert.ok(findBracketTag(desc, "Items")?.inner.includes("÷2"));
});

test("unbalanced tag is not partially consumed", () => {
  const desc = "Catatan [Items: tes (Rp 9.000)";
  assert.equal(stripBracketTag(desc, "Items"), "Catatan [Items: tes (Rp 9.000)");
});
