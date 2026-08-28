import { Toggle } from "@base-ui/react/toggle";
import { Tooltip } from "@base-ui/react/tooltip";
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

const buttonBase =
  "inline-flex items-center justify-center rounded-lg font-semibold transition-[background,color,border-color,transform] " +
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)] " +
  "enabled:active:translate-y-px";

const buttonVariants: Record<ButtonVariant, string> = {
  primary: "border-0 bg-[var(--accent)] text-white enabled:hover:bg-[var(--accent-hover)]",
  secondary:
    "border border-[var(--line)] bg-[var(--panel)] text-[var(--muted)] enabled:hover:bg-black/5 dark:enabled:hover:bg-white/8",
  danger:
    "border-0 bg-[#c24135] text-white enabled:hover:bg-[#a9362c] focus-visible:outline-[#c24135]",
  subtleDanger:
    "border border-[#deded9] bg-white text-[#777773] enabled:hover:border-[#d9b3ad] enabled:hover:bg-[#fff7f5] enabled:hover:text-[#b94b3d] dark:border-[#484843] dark:bg-[#272725] dark:text-[#b8b8b1] dark:enabled:hover:border-[#73443f] dark:enabled:hover:bg-[#352422] dark:enabled:hover:text-[#ff9a8f]",
};

const buttonSizes: Record<ButtonSize, string> = {
  sm: "min-h-[27px] px-2 py-1 text-[11px]",
  md: "min-h-9 px-3.5 py-2 text-[13px]",
  lg: "min-h-10 px-4 py-[11px] text-[13px]",
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
    <Tooltip.Root disabled={disabled}>
      <Tooltip.Trigger
        render={
          <button {...buttonProps} disabled={disabled} aria-label={label}>
            {children}
          </button>
        }
      />
      <TooltipContent label={label} />
    </Tooltip.Root>
  );
}

type TooltipToggleButtonProps = {
  label: string;
  value: string;
  className?: string | ((state: Toggle.State) => string | undefined);
  disabled?: boolean;
  children: ReactNode;
};

export function TooltipToggleButton(
  { label, value, className, disabled, children }: TooltipToggleButtonProps,
) {
  return (
    <Tooltip.Root disabled={disabled}>
      <Tooltip.Trigger
        render={
          <Toggle
            value={value}
            className={className}
            disabled={disabled}
            aria-label={label}
          >
            {children}
          </Toggle>
        }
      />
      <TooltipContent label={label} />
    </Tooltip.Root>
  );
}

function TooltipContent({ label }: { label: string }) {
  return (
    <Tooltip.Portal>
      <Tooltip.Positioner side="right" sideOffset={8}>
        <Tooltip.Popup className="z-[60] origin-[var(--transform-origin)] rounded-md bg-[#242422] px-2 py-1 text-xs font-semibold text-white shadow-lg transition-[opacity,transform] duration-100 data-[ending-style]:scale-95 data-[ending-style]:opacity-0 data-[instant]:transition-none data-[starting-style]:scale-95 data-[starting-style]:opacity-0 dark:bg-[#efefeb] dark:text-[#242422]">
          {label}
        </Tooltip.Popup>
      </Tooltip.Positioner>
    </Tooltip.Portal>
  );
}
