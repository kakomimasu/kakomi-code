import {
  type ComponentPropsWithoutRef,
  type ComponentPropsWithRef,
  forwardRef,
  type KeyboardEventHandler,
  type PointerEventHandler,
  type ReactNode,
} from "react";
import { classes } from "./common.tsx";

type ButtonVariant = "primary" | "secondary" | "danger" | "subtleDanger";
type ButtonSize = "sm" | "md" | "lg";

type ButtonProps = ComponentPropsWithRef<"button"> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
};

const buttonBase = "ui-button";

const buttonVariants: Record<ButtonVariant, string> = {
  primary: "ui-button-primary",
  secondary: "ui-button-secondary",
  danger: "ui-button-danger",
  subtleDanger: "ui-button-subtle-danger",
};

const buttonSizes: Record<ButtonSize, string> = {
  sm: "ui-button-sm",
  md: "ui-button-md",
  lg: "ui-button-lg",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", size = "md", className, ...buttonProps },
  ref,
) {
  return (
    <button
      {...buttonProps}
      ref={ref}
      className={classes(buttonBase, buttonVariants[variant], buttonSizes[size], className)}
    />
  );
});

export type StatusTone = "neutral" | "progress" | "success" | "error";

export function statusTone(message: string): StatusTone {
  const normalized = message.trim();
  if (!normalized) return "neutral";
  if (normalized.startsWith("エラー:") || normalized.includes("できませんでした")) {
    return "error";
  }
  if (normalized.endsWith("…")) return "progress";
  return "success";
}

export function StatusText({
  className,
  children,
  tone,
  ...paragraphProps
}: ComponentPropsWithoutRef<"p"> & { tone?: StatusTone }) {
  const resolvedTone = tone ?? statusTone(typeof children === "string" ? children : "");
  const error = resolvedTone === "error";
  return (
    <p
      {...paragraphProps}
      className={classes("status", className)}
      role={error ? "alert" : "status"}
      aria-live={error ? "assertive" : "polite"}
      aria-atomic="true"
      data-tone={resolvedTone}
    >
      {children}
    </p>
  );
}

export function ResizeHandle({
  hidden,
  side,
  label,
  controls,
  value,
  minimum,
  maximum,
  defaultValue,
  onValueChange,
  onPointerDown,
}: {
  hidden: boolean;
  side: "sidebar" | "utility";
  label: string;
  controls: string;
  value: number;
  minimum: number;
  maximum: number;
  defaultValue: number;
  onValueChange: (value: number) => void;
  onPointerDown: PointerEventHandler<HTMLDivElement>;
}) {
  const onKeyDown: KeyboardEventHandler<HTMLDivElement> = (event) => {
    const step = event.shiftKey ? 40 : 12;
    const direction = side === "sidebar" ? 1 : -1;
    let nextValue: number | undefined;
    if (event.key === "ArrowLeft") nextValue = value - step * direction;
    if (event.key === "ArrowRight") nextValue = value + step * direction;
    if (event.key === "Home") nextValue = minimum;
    if (event.key === "End") nextValue = maximum;
    if (nextValue === undefined) return;
    event.preventDefault();
    onValueChange(Math.max(minimum, Math.min(maximum, nextValue)));
  };

  return (
    <div
      className={`resize-handle ${side}-resize-handle`}
      hidden={hidden}
      role="separator"
      tabIndex={0}
      aria-label={label}
      aria-controls={controls}
      aria-orientation="vertical"
      aria-valuemin={minimum}
      aria-valuemax={maximum}
      aria-valuenow={value}
      aria-valuetext={`${value}ピクセル`}
      onKeyDown={onKeyDown}
      onPointerDown={onPointerDown}
      onDoubleClick={() => onValueChange(defaultValue)}
    />
  );
}

type TooltipButtonProps =
  & Omit<
    ComponentPropsWithoutRef<"button">,
    "aria-label" | "children" | "title"
  >
  & {
    label: string;
    children: ReactNode;
  };

export function TooltipButton({ label, children, disabled, ...buttonProps }: TooltipButtonProps) {
  return (
    <button {...buttonProps} disabled={disabled} aria-label={label} title={label}>
      {children}
    </button>
  );
}
