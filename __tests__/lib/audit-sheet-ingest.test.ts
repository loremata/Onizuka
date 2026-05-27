import {
  buildAuditSheetRowKey,
  parseAuditSheetCsv,
  parseAuditSheetRows,
  resolveAuditSheetCsvUrl,
} from "@/lib/audit-sheet-ingest";

describe("parseAuditSheetCsv", () => {
  it("parses vat and business columns", () => {
    const csv = `partita_iva,ragione_sociale,email,sito
12345678901,Acme Srl,info@acme.it,https://acme.it
`;
    const { rows, rejected } = parseAuditSheetCsv(csv);
    expect(rejected).toHaveLength(0);
    expect(rows).toHaveLength(1);
    expect(rows[0].kind).toBe("vat");
    expect(rows[0].vatNumber).toBe("12345678901");
    expect(rows[0].businessName).toBe("Acme Srl");
    expect(rows[0].contactEmail).toBe("info@acme.it");
  });

  it("parses domain-only row when website column present", () => {
    const csv = `sito,ragione_sociale
HTTPS://WWW.Esempio.IT/,Esempio Srl
`;
    const { rows, rejected } = parseAuditSheetCsv(csv);
    expect(rejected).toHaveLength(0);
    expect(rows).toHaveLength(1);
    expect(rows[0].kind).toBe("domain");
    expect(rows[0].vatNumber).toBeUndefined();
    expect(buildAuditSheetRowKey(rows[0])).toHaveLength(32);
  });

  it("normalizes domain row key for dedupe", () => {
    const row = {
      kind: "domain" as const,
      website: "https://www.Esempio.it/",
      rowIndex: 2,
    };
    const keyA = buildAuditSheetRowKey(row);
    const keyB = buildAuditSheetRowKey({
      ...row,
      website: "http://esempio.it",
    });
    expect(keyA).toBe(keyB);
  });

  it("parses name+city revision row", () => {
    const csv = `ragione_sociale,citta
Beta Srl,Milano
`;
    const { rows } = parseAuditSheetCsv(csv);
    expect(rows).toHaveLength(1);
    expect(rows[0].kind).toBe("name_city");
    expect(rows[0].businessName).toBe("Beta Srl");
    expect(rows[0].city).toBe("Milano");
  });

  it("rejects insufficient row", () => {
    const csv = `ragione_sociale,citta,email
Solo nome,,foo@test.it
`;
    const { rows, rejected } = parseAuditSheetCsv(csv);
    expect(rows).toHaveLength(0);
    expect(rejected).toHaveLength(1);
    expect(rejected[0].reason).toMatch(/insufficienti/i);
  });

  it("returns empty when no vat or website or name+city headers", () => {
    expect(parseAuditSheetCsv("nome,email\nfoo,bar")).toEqual({ rows: [], rejected: [] });
  });
});

describe("parseAuditSheetRows", () => {
  it("keeps vat path when both vat and domain present", () => {
    const { rows } = parseAuditSheetRows([
      ["partita_iva", "sito"],
      ["12345678901", "https://acme.it"],
    ]);
    expect(rows[0].kind).toBe("vat");
    expect(rows[0].vatNumber).toBe("12345678901");
  });
});

describe("resolveAuditSheetCsvUrl", () => {
  const prev = process.env;
  beforeEach(() => {
    process.env = { ...prev };
  });
  afterAll(() => {
    process.env = prev;
  });

  it("prefers direct CSV url", () => {
    process.env.GOOGLE_SHEET_AUDIT_CSV_URL = "https://example.com/sheet.csv";
    expect(resolveAuditSheetCsvUrl()).toBe("https://example.com/sheet.csv");
  });

  it("builds export url from spreadsheet id", () => {
    delete process.env.GOOGLE_SHEET_AUDIT_CSV_URL;
    process.env.GOOGLE_SHEET_AUDIT_SPREADSHEET_ID = "abc123";
    expect(resolveAuditSheetCsvUrl()).toContain("abc123");
  });
});
