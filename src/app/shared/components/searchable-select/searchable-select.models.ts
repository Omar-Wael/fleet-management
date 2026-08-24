export interface SearchableSelectOption {
  value: string;
  label: string;
  /** Optional secondary line shown under the label (e.g. plate number under vehicle name). */
  sublabel?: string;
  disabled?: boolean;
}
