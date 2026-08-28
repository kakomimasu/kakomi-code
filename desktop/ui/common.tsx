export function classes(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

export function EditIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="m4 16-.5 4.5L8 20l10.5-10.5-4-4z" />
      <path d="m12.5 7.5 4 4" />
    </svg>
  );
}

export function CopyIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M8 8h11v11H8z" />
      <path d="M5 16H4V4h12v1" />
    </svg>
  );
}

export function DeleteIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5 7h14" />
      <path d="M9 7V4h6v3" />
      <path d="m8 10 1 9h6l1-9" />
    </svg>
  );
}
