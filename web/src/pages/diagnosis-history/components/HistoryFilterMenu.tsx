import DropdownMenu from "@/components/DropdownMenu/DropdownMenu";
import Icon from "@/components/Icon/Icon";
import { cn } from "@/utils/cn";

type Option = { value: string; label: string };

/** History-only filter styling; the shared menu owns focus and keyboard navigation. */
export default function HistoryFilterMenu({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: Option[];
  onChange: (value: string) => void;
}) {
  const selected = options.find((option) => option.value === value) ?? options[0];
  const active = selected?.value !== options[0]?.value;
  return (
    <DropdownMenu
      label={label}
      className="shrink-0 [&_[role=menu]]:max-h-72 [&_[role=menu]]:min-w-48 [&_[role=menu]]:overflow-y-auto"
      items={options.map((option) => ({
        key: option.value,
        label: option.label.replace(/^.*? · /, ""),
        selected: option.value === value,
        onSelect: () => onChange(option.value),
      }))}
      renderTrigger={(props) => (
        <button
          {...props}
          type="button"
          aria-label={label}
          className={cn(
            "inline-flex h-10 items-center gap-2 rounded-full border px-4 text-sm font-medium whitespace-nowrap text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink",
            active
              ? "border-highlight bg-highlight"
              : "border-gray-300 bg-surface hover:bg-gray-50",
          )}
        >
          <Icon
            name="chevron-down"
            className={props["aria-expanded"] ? "size-4 rotate-180" : "size-4"}
          />
          {selected?.label}
        </button>
      )}
    />
  );
}
