/**
 * Vendored subset of kumo-ui's components.
 *
 * The published npm bundle embeds its own React (crashing hooks when mixed
 * with ours) and ships no source repository to fork, so these are faithful
 * re-implementations of the same components using kumo-ui's own stylesheet
 * classes — identical markup contract, single React copy.
 */
import { useState, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode } from "react";

type ButtonVariant = "primary" | "secondary" | "cancel" | "third" | "danger";

export function Button({
  variant = "primary",
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant }) {
  return (
    <button className={`button ${variant}`} {...rest}>
      {children}
    </button>
  );
}

/** Copy-to-clipboard button rendering the payload as its label. */
export function CopyButton({
  value,
  children,
}: {
  value: string;
  children?: ReactNode;
}) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      className="button secondary"
      title={`Copy: ${value}`}
      onClick={() => {
        navigator.clipboard?.writeText(value);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1200);
      }}
    >
      {copied ? "copied!" : (children ?? "copy")}
    </button>
  );
}

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input className="input" {...props} />;
}

export function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label>
      <span className="label">{label}</span>
      {children}
    </label>
  );
}

export function Loader() {
  return (
    <div className="loader-small">
      <div className="spinner-small" />
    </div>
  );
}
