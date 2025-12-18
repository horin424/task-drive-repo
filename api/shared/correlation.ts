import type { HttpRequest } from "@azure/functions";
import { randomUUID } from "crypto";

export const getCorrelationId = (request?: HttpRequest): string => {
  const headerId =
    request?.headers.get("x-correlation-id") ||
    request?.headers.get("X-Correlation-Id");
  return headerId || randomUUID();
};
