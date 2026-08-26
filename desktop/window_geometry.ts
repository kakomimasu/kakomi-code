export type WindowGeometry = {
  width: number;
  height: number;
  x: number;
  y: number;
};

const MIN_WIDTH = 320;
const MIN_HEIGHT = 300;
const MAX_SIZE = 16_384;
const MAX_POSITION = 32_768;

export function validateWindowGeometry(value: unknown): WindowGeometry {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("画面サイズを確認できませんでした。");
  }
  const geometry = value as Record<string, unknown>;
  const width = integerInRange(geometry.width, MIN_WIDTH, MAX_SIZE);
  const height = integerInRange(geometry.height, MIN_HEIGHT, MAX_SIZE);
  const x = integerInRange(geometry.x, -MAX_POSITION, MAX_POSITION);
  const y = integerInRange(geometry.y, -MAX_POSITION, MAX_POSITION);
  if (width === undefined || height === undefined || x === undefined || y === undefined) {
    throw new Error("画面サイズを確認できませんでした。");
  }
  return { width, height, x, y };
}

function integerInRange(value: unknown, min: number, max: number) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < min || value > max) {
    return undefined;
  }
  return Math.trunc(value);
}
