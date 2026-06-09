import { useState, type ReactNode } from "react";

type Side = "top" | "bottom" | "left" | "right";

const sideClasses: Record<Side, string> = {
  top: "bottom-full left-1/2 -translate-x-1/2 mb-1.5",
  bottom: "top-full left-1/2 -translate-x-1/2 mt-1.5",
  left: "right-full top-1/2 -translate-y-1/2 mr-1.5",
  right: "left-full top-1/2 -translate-y-1/2 ml-1.5",
};

/** Lightweight hover/focus tooltip. Wrap any control to label what it does. */
export function Tooltip({
  label,
  side = "bottom",
  children,
}: {
  label: string;
  side?: Side;
  children: ReactNode;
}) {
  const [show, setShow] = useState(false);
  return (
    <span
      className="relative inline-flex"
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
      onFocusCapture={() => setShow(true)}
      onBlurCapture={() => setShow(false)}
    >
      {children}
      {show && (
        <span
          role="tooltip"
          className={`pointer-events-none absolute z-50 whitespace-nowrap rounded-md bg-ink-900 px-2 py-1 text-xs font-medium text-white shadow-lg dark:bg-navy-700 ${sideClasses[side]}`}
        >
          {label}
        </span>
      )}
    </span>
  );
}
