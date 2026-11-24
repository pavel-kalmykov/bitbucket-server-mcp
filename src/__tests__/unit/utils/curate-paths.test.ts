import { DEFAULT_BRANCH_FIELDS } from "../../../response/curate.js";

describe("PathsOf validation", () => {
  test("field paths are valid per the generated schema", () => {
    // Typo en un path: rechazado en compilacion. Verificado con un
    // scratch file: `const wrong: typeof DEFAULT_BRANCH_FIELDS =
    // ["typoName"]` falla en tsc con TS2322 ("typoName" is not assignable
    // to type '"isDefault" | "metadata" | ...'), porque el tipo del
    // default es FieldOf<RestBranch, "isDefault" | "metadata">.
    const good = [...DEFAULT_BRANCH_FIELDS];
    expect(good).toContain("id");
    expect(good).not.toContain("groups.name");
  });
});
