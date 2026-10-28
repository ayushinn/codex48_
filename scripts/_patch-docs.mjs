import { readFileSync, writeFileSync } from "node:fs";

// Fix SUBMISSION.md — remove "(must be flipped...)" text
const subPath = "SUBMISSION.md";
let sub = readFileSync(subPath, "utf8");
sub = sub.replace(
  /- \*\*Source-code repository:\*\* https:\/\/github\.com\/ayushinn\/codex48_ \(must be flipped to\r\n  \*\*public\*\* before filing — judges must open it without signing in; no secrets are committed\r\n  and `\.env` is gitignored\)/,
  "- **Source-code repository:** https://github.com/ayushinn/codex48_ (public repository — no secrets committed, `.env` is gitignored)"
);
writeFileSync(subPath, sub);
console.log("SUBMISSION.md patched");

// Fix README.md — "Next.js 15" → "Next.js 16"
const readmePath = "README.md";
let readme = readFileSync(readmePath, "utf8");
const before = readme;
readme = readme.replace(/Next\.js 15/g, "Next.js 16");
if (readme === before) {
  console.error("README.md: no match found for 'Next.js 15'");
  process.exit(1);
}
writeFileSync(readmePath, readme);
console.log("README.md patched");
