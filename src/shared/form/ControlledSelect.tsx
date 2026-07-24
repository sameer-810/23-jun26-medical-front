import React, { ComponentProps } from "react";
import {
  useController,
  Control,
  FieldValues,
  FieldPath,
} from "react-hook-form";
import { Select } from "@shared/ui";

/**
 * A Select bound to react-hook-form, same idea as ControlledTextField.
 *
 * Keeps every form value — including dropdown choices — in one place, so an edit
 * form populates with a single `reset()` and never juggles side state.
 */
type SelectProps = ComponentProps<typeof Select>;

interface Props<T extends FieldValues> extends Omit<
  SelectProps,
  "value" | "onChange" | "error"
> {
  control: Control<T>;
  name: FieldPath<T>;
}

export function ControlledSelect<T extends FieldValues>({
  control,
  name,
  ...selectProps
}: Props<T>) {
  const { field, fieldState } = useController({ control, name });
  return (
    <Select
      {...selectProps}
      value={field.value == null ? null : String(field.value)}
      onChange={field.onChange}
      error={fieldState.error?.message}
    />
  );
}
