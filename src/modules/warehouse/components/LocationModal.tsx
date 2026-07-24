import React, { useEffect } from "react";
import { View, Modal, Pressable, StyleSheet } from "react-native";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { X } from "lucide-react-native";
import {
  useCreateLocation,
  useRenameLocation,
} from "@modules/warehouse/hooks/useWarehouse";
import {
  LocationTreeNode,
  LocationType,
  TYPE_LABELS,
} from "@modules/warehouse/types";
import { locationSchema } from "@modules/warehouse/location.validation";
import { apiErrorMessage } from "@api/apiClient";
import { ControlledTextField } from "@shared/form/ControlledTextField";
import { palette, radius, shadows } from "@shared/designSystem";
import { Text, VStack, HStack, Button, ChipsRow } from "@shared/ui";

type Mode = "createWarehouse" | "createChild" | "rename";

interface Props {
  visible: boolean;
  mode: Mode;
  parent?: LocationTreeNode | null;
  node?: LocationTreeNode | null;
  onClose: () => void;
}

export function LocationModal({ visible, mode, parent, node, onClose }: Props) {
  const createMut = useCreateLocation();
  const renameMut = useRenameLocation();
  const allowed = parent?.allowedChildTypes || [];

  const { control, handleSubmit, reset } = useForm({
    resolver: zodResolver(locationSchema),
    mode: "onTouched",
    defaultValues: { name: "", type: "zone", mode },
  });

  // Reopening the modal reseeds it — a single reset(), so no side setState.
  useEffect(() => {
    if (visible) {
      reset({
        name: mode === "rename" ? node?.name || "" : "",
        type: mode === "createChild" && allowed.length ? allowed[0] : "zone",
        mode,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const busy = createMut.isPending || renameMut.isPending;
  const error = createMut.error || renameMut.error;

  const title =
    mode === "createWarehouse"
      ? "New warehouse"
      : mode === "rename"
        ? "Rename location"
        : `Add to ${parent?.code}`;

  const submit = handleSubmit((f) => {
    const name = f.name.trim();
    if (mode === "rename") {
      if (!node) return;
      renameMut.mutate({ id: node.id, name }, { onSuccess: onClose });
    } else if (mode === "createWarehouse") {
      createMut.mutate(
        { type: "warehouse", name: name || undefined },
        { onSuccess: onClose },
      );
    } else {
      if (!parent) return;
      createMut.mutate(
        {
          type: f.type as LocationType,
          name: name || undefined,
          parentId: parent.id,
        },
        { onSuccess: onClose },
      );
    }
  });

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <HStack
            align="center"
            justify="space-between"
            style={{ marginBottom: 16 }}
          >
            <Text variant="h3" tone="primary">
              {title}
            </Text>
            <Pressable onPress={onClose} hitSlop={8}>
              <X size={20} color={palette.text.tertiary} strokeWidth={2} />
            </Pressable>
          </HStack>

          <VStack gap={16}>
            {error ? (
              <View style={errBox}>
                <Text variant="body-sm" tone="danger">
                  {apiErrorMessage(error)}
                </Text>
              </View>
            ) : null}

            {mode === "createChild" && allowed.length > 1 && (
              <View>
                <Text
                  variant="label"
                  tone="secondary"
                  style={{ marginBottom: 8 }}
                >
                  Type
                </Text>
                <Controller
                  control={control}
                  name="type"
                  render={({ field }) => (
                    <ChipsRow
                      chips={allowed.map((t) => ({
                        key: t,
                        label: TYPE_LABELS[t],
                      }))}
                      active={field.value}
                      onChange={field.onChange}
                    />
                  )}
                />
              </View>
            )}
            {mode === "createChild" && allowed.length === 1 && (
              <Text variant="body-sm" tone="tertiary">
                Adding a {TYPE_LABELS[allowed[0]]} under {parent?.code}.
              </Text>
            )}

            <ControlledTextField
              control={control}
              name="name"
              label={mode === "rename" ? "Name" : "Name (optional)"}
              placeholder={
                mode === "createWarehouse"
                  ? "Main Warehouse"
                  : mode === "rename"
                    ? node?.name
                    : "Auto-named if blank"
              }
              onSubmitEditing={submit}
            />

            <Button
              label={mode === "rename" ? "Save" : "Create"}
              loading={busy}
              onPress={submit}
            />
          </VStack>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(15,23,42,0.4)",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  sheet: {
    width: "100%",
    maxWidth: 440,
    backgroundColor: palette.surface.primary,
    borderRadius: radius.lg,
    padding: 20,
    ...shadows.xl,
  },
});

const errBox = {
  padding: 12,
  borderRadius: radius.md,
  backgroundColor: palette.danger.bg,
  borderWidth: 1,
  borderColor: palette.danger.border,
} as const;
