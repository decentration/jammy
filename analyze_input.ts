import fs from "fs";
import { CHAIN_TYPE, JAM_TEST_VECTORS } from "./src/consts";

const testName = "process_one_immediate_report-1";
const filePath = `${JAM_TEST_VECTORS}/stf/accumulate/${CHAIN_TYPE}/${testName}.json`;
const testVector = JSON.parse(fs.readFileSync(filePath, "utf8"));

console.log("Full input structure:");
console.log(JSON.stringify(testVector.input, null, 2).substring(0, 2000));

console.log("\n\nPre-state accounts:");
const accounts = testVector.pre_state.accounts;
console.log(`Total accounts: ${accounts?.length}`);
for (const acc of accounts || []) {
  console.log(`  Account ${acc.id}: service=${!!acc.data?.service}, storage_count=${acc.data?.storage?.length || 0}`);
}

console.log("\n\nPre-state queues:");
console.log(`accumulate_queue length: ${testVector.pre_state.accumulate_queue?.items?.length || 0}`);
if (testVector.pre_state.accumulate_queue?.items?.[0]) {
  const item = testVector.pre_state.accumulate_queue.items[0];
  console.log(`First queue item service_id: ${item.service_id}`);
  console.log(`First queue item result type: ${Object.keys(item.result || {})}`);
}
