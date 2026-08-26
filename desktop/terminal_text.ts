type TerminalState = "text" | "escape" | "csi" | "string" | "stringEscape";

export function createTerminalTextSanitizer() {
  let state: TerminalState = "text";

  return {
    write(input: string) {
      let output = "";
      for (const character of input) {
        const code = character.charCodeAt(0);
        if (state === "text") {
          if (code === 0x1b) {
            state = "escape";
          } else if (code === 0x9b) {
            state = "csi";
          } else if ([0x90, 0x98, 0x9d, 0x9e, 0x9f].includes(code)) {
            state = "string";
          } else if (!isUnsupportedControl(code)) {
            output += character;
          }
        } else if (state === "escape") {
          if (character === "[") state = "csi";
          else if ("]PX^_".includes(character)) state = "string";
          else if (code < 0x20 || code > 0x2f) state = "text";
        } else if (state === "csi") {
          if (code >= 0x40 && code <= 0x7e) state = "text";
        } else if (state === "string") {
          if (code === 0x07 || code === 0x9c) state = "text";
          else if (code === 0x1b) state = "stringEscape";
        } else if (character === "\\") {
          state = "text";
        } else if (code !== 0x1b) {
          state = "string";
        }
      }
      return output;
    },
  };
}

export function stripTerminalSequences(input: string) {
  return createTerminalTextSanitizer().write(input);
}

function isUnsupportedControl(code: number) {
  return (code < 0x20 && code !== 0x09 && code !== 0x0a && code !== 0x0d) ||
    (code >= 0x7f && code <= 0x9f);
}
