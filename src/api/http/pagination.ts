import { z } from "zod";
import { logger } from "../../logging.js";

const paginatedSchema = z.object({
  values: z.array(z.record(z.string(), z.unknown())),
  isLastPage: z.boolean(),
  size: z.number().optional(),
  limit: z.number().optional(),
  start: z.number().optional(),
  nextPageStart: z.number().optional(),
});

// Fallback bar for off-spec pages: any body whose values is an array.
const loosePageSchema = z.object({
  values: z.array(z.unknown()),
});

export type Paginated<T = Record<string, unknown>> = {
  values: T[];
  isLastPage: boolean;
  size?: number;
  limit?: number;
  start?: number;
  nextPageStart?: number;
};

export function validatePaginated<T = Record<string, unknown>>(
  data: unknown,
  context: string,
): Paginated<T> {
  const result = paginatedSchema.safeParse(data);
  if (result.success) {
    // The envelope is schema-validated; the row type is the endpoint's
    // contract, which no runtime schema here can check.
    return { ...result.data, values: result.data.values as unknown as T[] };
  }
  logger.warn(
    `Unexpected paginated response in ${context}`,
    z.flattenError(result.error),
  );
  if (loosePageSchema.safeParse(data).success) {
    // The page is off-spec but usable; return it as-is so callers keep
    // any fields beyond the envelope.
    return data as Paginated<T>;
  }
  throw new Error(`Invalid paginated response from ${context}`);
}
