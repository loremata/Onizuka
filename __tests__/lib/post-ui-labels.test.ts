import {
  platformLabelIt,
  platformSelectRows,
  postStatusLabelIt,
  postStatusSelectRows,
} from "@/lib/post-ui-labels";

describe("post-ui-labels", () => {
  it("mantiene ordine fisso delle piattaforme nei select", () => {
    expect(platformSelectRows().map((r) => r.value)).toEqual([
      "FACEBOOK",
      "INSTAGRAM",
      "LINKEDIN",
      "GBP",
    ]);
  });

  it("allinea etichetta GBP al nome prodotto completo", () => {
    expect(platformLabelIt.GBP).toBe("Google Business Profile");
  });

  it("espone tutti gli stati post in italiano", () => {
    expect(postStatusLabelIt.PENDING).toBe("In attesa");
    expect(postStatusLabelIt.APPROVED).toBe("Approvato");
    expect(postStatusLabelIt.NEEDS_REVISION).toBe("Richiede modifiche");
    expect(postStatusSelectRows()).toHaveLength(3);
  });
});
