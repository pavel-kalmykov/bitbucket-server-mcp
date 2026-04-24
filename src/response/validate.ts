import { z } from "zod";
import { logger } from "../logging.js";

export const paginatedSchema = z.object({
  values: z.array(z.record(z.string(), z.unknown())),
  isLastPage: z.boolean(),
  size: z.number().optional(),
  limit: z.number().optional(),
  start: z.number().optional(),
  nextPageStart: z.number().optional(),
});

export type Paginated = z.infer<typeof paginatedSchema>;

export function validatePaginated(data: unknown, context: string): Paginated {
  const result = paginatedSchema.safeParse(data);
  if (!result.success) {
    logger.warn(
      `Unexpected paginated response in ${context}`,
      result.error.flatten(),
    );
    if (
      data &&
      typeof data === "object" &&
      Array.isArray((data as Record<string, unknown>).values)
    ) {
      return data as Paginated;
    }
    throw new Error(`Invalid paginated response from ${context}`);
  }
  return result.data;
}
