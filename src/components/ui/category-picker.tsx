import { Choice, Choices } from './choices';
import { CategoryFilter } from './category-filter';
export type CategoryPickerProps = { label: string; value: string; options: { id: string; label: string }[]; disabled?: boolean; onChange: (id: string) => void };
/** Accessible wrapping options on web; native uses the system menu picker. */
export function CategoryPicker({ label, value, options, disabled, onChange }: CategoryPickerProps) {
  return <CategoryFilter options={options} value={value} disabled={disabled}>{filtered =>
    <Choices label={label}>{filtered.map(option => <Choice key={option.id} label={option.label}
      selected={option.id === value} disabled={disabled} onPress={() => onChange(option.id)} />)}</Choices>}
  </CategoryFilter>;
}
