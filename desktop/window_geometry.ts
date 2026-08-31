import { z } from "zod";
import { parseInput } from "./input_validation.ts";

const MIN_WIDTH = 320;
const MIN_HEIGHT = 300;
const MAX_SIZE = 16_384;
const MAX_POSITION = 32_768;
const GEOMETRY_ERROR = "画面サイズを確認できませんでした。";

function coordinate(minimum: number, maximum: number) {
  return z.number({ error: GEOMETRY_ERROR })
    .min(minimum, { error: GEOMETRY_ERROR })
    .max(maximum, { error: GEOMETRY_ERROR })
    .transform(Math.trunc);
}

const windowGeometrySchema = z.object({
  width: coordinate(MIN_WIDTH, MAX_SIZE),
  height: coordinate(MIN_HEIGHT, MAX_SIZE),
  x: coordinate(-MAX_POSITION, MAX_POSITION),
  y: coordinate(-MAX_POSITION, MAX_POSITION),
}, { error: GEOMETRY_ERROR });

export type WindowGeometry = z.output<typeof windowGeometrySchema>;

export function validateWindowGeometry(value: unknown): WindowGeometry {
  return parseInput(windowGeometrySchema, value);
}
