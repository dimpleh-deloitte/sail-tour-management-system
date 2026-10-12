// Ported from the legacy prototype's Button variants/press-scale feel.
import { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "outline" | "secondary" | "ghost" | "destructive";
type Size = "sm" | "default" | "lg";

const VARIANT_CLASSES: Record<Variant, string> = {
  primary: "bg-sail-500 text-white shadow-sm hover:bg-sail-600 hover:shadow-md",
  outline: "border border-steel-200 bg-white shadow-sm hover:bg-steel-50 hover:border-steel-300 text-steel-700",
  secondary: "bg-steel-100 text-steel-700 hover:bg-steel-200",
  ghost: "text-steel-600 hover:bg-steel-100",
  destructive: "border border-red-200 text-red-600 hover:bg-red-50",
};

const SIZE_CLASSES: Record<Size, string> = {
  sm: "h-8 px-3 text-xs",
  default: "h-10 px-5 text-sm",
  lg: "h-11 px-7 text-base",
};

export function Button({
  variant = "primary",
  size = "default",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size }) {
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-xl font-medium transition-all duration-200 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 ${VARIANT_CLASSES[variant]} ${SIZE_CLASSES[size]} ${className}`}
      {...props}
    />
  );
}
