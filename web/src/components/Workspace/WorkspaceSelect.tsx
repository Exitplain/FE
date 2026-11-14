import Icon from "@/components/Icon/Icon";
import { cn } from "@/utils/cn";

type Option = { value: string; label: string };
export default function WorkspaceSelect({
  label,
  value,
  onChange,
  options,
  full = false,
  id,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Option[];
  full?: boolean;
  id?: string;
}) {
  return (
    <label
      className={cn(
        "relative inline-flex min-h-10 items-center rounded-full border border-gray-300 bg-surface text-sm",
        full && "w-full rounded-lg",
        value !== "all" && value !== "30" && !full && "border-highlight bg-highlight",
      )}
    >
      <span className="sr-only">{label}</span>
      <Icon name="chevron-down" className="pointer-events-none absolute right-3 size-4" />
      <select
        id={id}
        aria-label={label}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={cn(
          "min-h-10 w-full cursor-pointer appearance-none bg-transparent py-2 pr-9 pl-4 outline-offset-2 focus-visible:outline-2 focus-visible:outline-ink",
          full ? "rounded-lg" : "rounded-full",
        )}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}
