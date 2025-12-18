import { app, InvocationContext, Timer } from "@azure/functions";
import { CosmosClient, PatchOperation } from "@azure/cosmos";

// --- Configuration ---
const cosmosDbConnectionString = process.env.COSMOS_DB_CONNECTION_STRING || "";
const cosmosDbDatabaseName = process.env.COSMOS_DB_DATABASE_NAME || "AppDb";
const orgsContainerName =
  process.env.ORGANIZATIONS_CONTAINER_NAME || "Organizations";
let cosmosClient: CosmosClient;

function initializeCosmosClient(context: InvocationContext) {
  if (cosmosClient) return;
  if (!cosmosDbConnectionString)
    throw new Error("COSMOS_DB_CONNECTION_STRING is not set.");
  cosmosClient = new CosmosClient(cosmosDbConnectionString);
  context.log("Timer: Cosmos Client initialized.");
}

export async function TimerTriggerMonthlyReset(
  myTimer: Timer,
  context: InvocationContext
): Promise<void> {
  const timeStamp = new Date().toISOString();
  context.log("Monthly Reset Timer function triggered!", timeStamp);

  try {
    initializeCosmosClient(context);
    const database = cosmosClient.database(cosmosDbDatabaseName);
    const container = database.container(orgsContainerName);

    context.log(
      `Querying container '${orgsContainerName}' for items to reset...`
    );
    // Query for all documents
    const querySpec = { query: "SELECT * FROM c" };
    const { resources: items } = await container.items
      .query<{
        id: string;
        monthlyMinutesLimit?: number;
        monthlyTasksLimit?: number;
      }>(querySpec)
      .fetchAll();

    if (!items || items.length === 0) {
      context.log("No organization records found to reset.");
      return;
    }
    context.log(`Found ${items.length} organizations to process for reset.`);

    const resetPromises = items.map((item) => {
      const resetMinutes = item.monthlyMinutesLimit ?? 6000; // Default
      const resetTasks = item.monthlyTasksLimit ?? 100; // Default

      const operations: PatchOperation[] = [
        { op: "set", path: "/remainingMinutes", value: resetMinutes },
        { op: "set", path: "/remainingTasks", value: resetTasks },
        { op: "set", path: "/lastResetTimestamp", value: timeStamp },
      ];

      context.log(`Resetting limits for Org ID: ${item.id}`);
      return container
        .item(item.id, item.id)
        .patch(operations)
        .catch((err) =>
          context.error(`Failed to patch Org ID: ${item.id}:`, err)
        );
    });

    await Promise.all(resetPromises);
    context.log("Monthly reset process completed.");
  } catch (error) {
    context.error("Error during monthly reset:", error);
  }
}

// Schedule: 00:00 (midnight) UTC on the 1st day of every month
app.timer("TimerTriggerMonthlyReset", {
  schedule: "0 0 0 1 * *",
  handler: TimerTriggerMonthlyReset,
});
