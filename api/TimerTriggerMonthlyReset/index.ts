import { app, InvocationContext, Timer } from "@azure/functions";
import type { PatchOperation } from "@azure/cosmos";
import { CONTAINERS, patchItem, queryItems } from "../shared/cosmosClient";
import type { Organization } from "../shared/models";

const defaultMonthlyMinutes = Number(process.env.DEFAULT_MONTHLY_MINUTES) || 6000;
const defaultMonthlyTaskGenerations =
  Number(process.env.DEFAULT_MONTHLY_TASK_GENERATIONS) || 100;

export async function TimerTriggerMonthlyReset(
  myTimer: Timer,
  context: InvocationContext
): Promise<void> {
  const timeStamp = new Date().toISOString();
  context.log("Monthly Reset Timer function triggered!", timeStamp);

  try {
    context.log(`Querying '${CONTAINERS.ORGANIZATIONS}' for monthly resets...`);

    const orgs = await queryItems<
      Pick<Organization, "id" | "monthlyMinutes" | "monthlyTaskGenerations">
    >(
      CONTAINERS.ORGANIZATIONS,
      "SELECT c.id, c.monthlyMinutes, c.monthlyTaskGenerations FROM c"
    );

    if (!orgs || orgs.length === 0) {
      context.log("No organization records found to reset.");
      return;
    }
    context.log(`Found ${orgs.length} organizations to process for reset.`);

    const resetPromises = orgs.map(async (org) => {
      const resetMinutes = org.monthlyMinutes ?? defaultMonthlyMinutes;
      const resetTasks =
        org.monthlyTaskGenerations ?? defaultMonthlyTaskGenerations;

      const operations: PatchOperation[] = [
        { op: "set", path: "/remainingMinutes", value: resetMinutes },
        { op: "set", path: "/remainingTaskGenerations", value: resetTasks },
        { op: "set", path: "/lastResetTimestamp", value: timeStamp },
        { op: "set", path: "/updatedAt", value: timeStamp },
      ];

      context.log(`Resetting limits for Org ID: ${org.id}`);
      await patchItem(CONTAINERS.ORGANIZATIONS, org.id, org.id, operations);
    });

    await Promise.all(
      resetPromises.map((promise, index) =>
        promise.catch((err) => {
          const orgId = orgs[index]?.id ?? "unknown";
          context.error(`Failed to patch Org ID: ${orgId}:`, err);
        })
      )
    );
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
