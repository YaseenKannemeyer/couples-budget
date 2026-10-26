import { Choice, Choices } from './choices';
export type CategoryPickerProps = { label: string; value: string; options: { id: string; label: string }[]; disabled?: boolean; onChange: (id: string) => void };
/** Accessible wrapping options on web; native uses the system menu picker. */
export function CategoryPicker({ label, value, options, disabled, onChange }: CategoryPickerProps) {
  return <Choices label={label}>{options.map(option => <Choice key={option.id} label={option.label}
    selected={option.id === value} disabled={disabled} onPress={() => onChange(option.id)} />)}</Choices>;
}
