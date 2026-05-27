import fs from "fs";
import path from "path";
import { PDFParse } from "pdf-parse";

const dir = process.argv[2] || "c:\\Users\\Mata\\Desktop\\StationHQ pre Onizuka";
const files = fs.readdirSync(dir).filter((f) => f.toLowerCase().endsWith(".pdf"));

for (const f of files) {
  const buf = fs.readFileSync(path.join(dir, f));
  const parser = new PDFParse({ data: buf });
  const result = await parser.getText();
  console.log("\n==========", f, "==========\n");
  console.log(result.text.slice(0, 14000));
  await parser.destroy();
}
