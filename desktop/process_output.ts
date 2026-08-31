import { createTerminalTextSanitizer } from "./terminal_text.ts";

export const MAX_CAPTURED_OUTPUT_CHARACTERS = 1_000_000;
export const MAX_LOG_TEXT_CHARACTERS = 12_000;

export function appendCapturedOutput(current: string, text: string): string {
  if (current.length >= MAX_CAPTURED_OUTPUT_CHARACTERS) return current;
  return current + text.slice(0, MAX_CAPTURED_OUTPUT_CHARACTERS - current.length);
}

export async function captureOutput(
  stream: ReadableStream<Uint8Array>,
  label: "stdout" | "stderr",
  onChunk: (message: string) => void,
): Promise<string> {
  const decoder = new TextDecoder();
  const sanitizer = createTerminalTextSanitizer();
  let output = "";
  for await (const chunk of stream) {
    const text = decoder.decode(chunk, { stream: true });
    const cleanText = sanitizer.write(text);
    output = appendCapturedOutput(output, cleanText);
    if (cleanText) onChunk(`[${label}] ${cleanText}`);
  }
  const remaining = decoder.decode();
  const cleanRemaining = sanitizer.write(remaining);
  output = appendCapturedOutput(output, cleanRemaining);
  if (cleanRemaining) onChunk(`[${label}] ${cleanRemaining}`);
  return output;
}
