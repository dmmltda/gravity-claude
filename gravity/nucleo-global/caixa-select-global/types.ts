export interface SelectOption {
  value: string
  label: string
  disabled?: boolean
}

export interface SelectPropsBase {
  options: SelectOption[]
  placeholder?: string
  disabled?: boolean
  id?: string
  name?: string
}

export interface SelectPropsSingle extends SelectPropsBase {
  multiple?: false
  value: string | null
  onChange: (value: string | null) => void
}

export interface SelectPropsMultiple extends SelectPropsBase {
  multiple: true
  value: string[]
  onChange: (value: string[]) => void
}

export type SelectProps = SelectPropsSingle | SelectPropsMultiple
