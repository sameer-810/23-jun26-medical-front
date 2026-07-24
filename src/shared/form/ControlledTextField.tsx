import React, { ComponentProps } from "react";
import {
  useController,
  Control,
  FieldValues,
  FieldPath,
} from "react-hook-form";
import { TextField } from "@shared/ui";

/**
 * A React Native TextField bound to react-hook-form.
 *
 * This is the RN-idiomatic way to use react-hook-form: RN's TextInput has no DOM
 * ref, so the web `register()` path  doesn't
 * apply — the official answer is a controlled input powered by `useController`.
 * The RHF docs specifically recommend wrapping it once, here, so every form gets
 * value/onBlur/error wiring for free and screens stay declarative.
 */
type TextFieldProps = ComponentProps<typeof TextField>;

interface Props<T extends FieldValues> extends Omit<
  TextFieldProps,
  "value" | "onChangeText" | "onBlur" | "error"
> {
  control: Control<T>;
  name: FieldPath<T>;
}

export function ControlledTextField<T extends FieldValues>({
  control,
  name,
  ...textFieldProps
}: Props<T>) {
  const { field, fieldState } = useController({ control, name });
  return (
    <TextField
      {...textFieldProps}
      value={field.value == null ? "" : String(field.value)}
      onChangeText={field.onChange}
      onBlur={field.onBlur}
      error={fieldState.error?.message}
    />
  );
}
