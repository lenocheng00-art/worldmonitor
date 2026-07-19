import { createStagingDatabaseClient, resetApplicationSchema, seedV18Fixture } from "./lib/staging-database";

async function main() {
  const { client, safe } = createStagingDatabaseClient();
  await client.connect();
  try {
    await resetApplicationSchema(client);
    await seedV18Fixture(client);
    process.stdout.write(`${JSON.stringify({ status: "PASS", projectRef: safe.projectRef, fixture: "synthetic-v1.8", productionRowsCopied: 0 })}\n`);
  } finally {
    await client.end();
  }
}

void main();
