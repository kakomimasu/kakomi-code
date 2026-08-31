import { z } from "zod";
import { parseInput, versionDirectorySchema } from "./input_validation.ts";

export const MAX_SOURCE_CHARACTERS = 1_000_000;

const AGENT_NAME_ERROR = "AI名を入力してください。";
const RENAME_ERROR = "AI名は1〜40文字で入力してください。";
const SOURCE_ERROR = "ソースは1〜1,000,000文字で入力してください。";

const createVersionRequestSchema = z.object({
  agentName: z.string({ error: AGENT_NAME_ERROR })
    .trim()
    .min(1, { error: AGENT_NAME_ERROR })
    .max(40, { error: "AI名は40文字以内で入力してください。" }),
  sourceVersion: z.preprocess(
    (value) => value === null ? undefined : value,
    z.string({ error: "コピー元のバージョンが不正です。" }).optional(),
  ),
}, { error: AGENT_NAME_ERROR });

const renameVersionRequestSchema = z.object({
  versionDir: versionDirectorySchema,
  agentName: z.string({ error: RENAME_ERROR })
    .trim()
    .min(1, { error: RENAME_ERROR })
    .max(40, { error: RENAME_ERROR })
    .regex(/^[^\r\n]*$/, { error: RENAME_ERROR }),
}, { error: "名前変更の内容が不正です。" });

const sourceSchema = z.string({ error: SOURCE_ERROR })
  .max(MAX_SOURCE_CHARACTERS, { error: SOURCE_ERROR })
  .refine((source) => source.trim().length > 0, { error: SOURCE_ERROR });

const saveSourceRequestSchema = z.object({
  versionDir: versionDirectorySchema,
  source: sourceSchema,
});

export type CreateVersionRequest = z.output<typeof createVersionRequestSchema>;
export type RenameVersionRequest = z.output<typeof renameVersionRequestSchema>;
export type SaveSourceRequest = z.output<typeof saveSourceRequestSchema>;

export function parseVersionDirectory(value: unknown): string {
  return parseInput(versionDirectorySchema, value);
}

export function parseCreateVersionRequest(value: unknown): CreateVersionRequest {
  const request = typeof value === "string" ? { agentName: value } : value;
  return parseInput(createVersionRequestSchema, request);
}

export function parseRenameVersionRequest(value: unknown): RenameVersionRequest {
  return parseInput(renameVersionRequestSchema, value);
}

export function parseSaveSourceRequest(
  versionDir: unknown,
  source: unknown,
): SaveSourceRequest {
  return parseInput(saveSourceRequestSchema, { versionDir, source });
}
