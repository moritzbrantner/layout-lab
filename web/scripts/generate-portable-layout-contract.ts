import {readFileSync, writeFileSync} from "node:fs";
import {fileURLToPath} from "node:url";
import {serializePortableLayoutContract} from "../lib/layout-portable-contract";

const contractPath = fileURLToPath(new URL("../../contracts/layout-core-v1.json", import.meta.url));
const expected = serializePortableLayoutContract();

if (process.argv.includes("--check")) {
  const current = readFileSync(contractPath, "utf8");
  if (current !== expected) {
    throw new Error("contracts/layout-core-v1.json is stale; regenerate it from the TypeScript clean-layout authority");
  }
} else {
  writeFileSync(contractPath, expected);
}
