import { z } from "zod";

const VERSION_DIRECTORY_ERROR = "バージョンを選択してください。";

export const versionDirectorySchema = z.string({ error: VERSION_DIRECTORY_ERROR })
  .min(1, { error: VERSION_DIRECTORY_ERROR });

export function parseInput<Schema extends z.ZodType>(
  schema: Schema,
  value: unknown,
): z.output<Schema> {
  const result = schema.safeParse(value);
  if (!result.success) {
    throw new Error(result.error.issues[0]?.message ?? "入力が不正です。");
  }
  return result.data;
}
