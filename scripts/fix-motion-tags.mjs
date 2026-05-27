import fs from "fs";
const file = process.argv[2];
if (!file) process.exit(1);
let c = fs.readFileSync(file, "utf8");
c = c.replaceAll("<motion", "<div").replaceAll("</motion>", "</div>");
fs.writeFileSync(file, c);
