/**
 * CLI: addestramento dedupe locale + import pesi in DB.
 * Uso: npm run dedupe:train
 */
import { trainAndApplyDedupeModel } from "../src/lib/client-dedupe-training";

async function main() {
  const result = await trainAndApplyDedupeModel({ datasetLimit: 800, backfillLimit: 1000 });
  if ("error" in result) {
    console.error(result.error);
    process.exit(1);
  }
  console.log(
    `OK version=${result.version} pairs=${result.pairs} backfilled=${result.backfilled}`
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
