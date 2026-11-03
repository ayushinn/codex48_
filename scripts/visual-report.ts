import { runVisualAudit, VISUAL_CONFIG } from "../src/lib/visual-testset";

const audit = runVisualAudit();
console.log("config:", JSON.stringify(VISUAL_CONFIG));
for (const c of audit.cases) {
  console.log(`\n[${c.testCase.id}] ${c.testCase.name} (${c.testCase.kind}) — ${c.matched ? "MATCH" : "MISMATCH"}`);
  for (const r of c.results) {
    const expected = c.testCase.expect[r.rule];
    const exp = expected === undefined ? "-" : expected ? "pass" : "fail";
    console.log(`  ${r.rule}: ${r.passed ? "PASS" : "FAIL"} (expected ${exp}) measured=${r.measured} required=${r.required}`);
  }
}
console.log(`\nsummary: matchedCases=${audit.matchedCases}/${audit.cases.length} passRate=${audit.passRate}% totalRules=${audit.totalRules} passedRules=${audit.passedRules}`);
