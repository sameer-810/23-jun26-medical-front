/**
 * Quick-add a customer from the till, with a mobile number.
 *
 * The Select's inline "Add new" makes a record from a NAME alone, which is all
 * the picker can offer. At a pharmacy counter the phone number is the half that
 * matters: it is how a refill reminder goes out and how the same person is
 * found next visit. A customer saved without one has to be edited later from
 * another screen, which nobody does mid-sale.
 *
 * Mobile stays optional — a walk-in who will not give a number must not block
 * the bill — but it is asked for, in front of the person who can supply it.
 */
import React, { useState } from "react";
import { Modal, View, Pressable, StyleSheet } from "react-native";
import { Phone, User } from "lucide-react-native";
import { palette, radius, shadows } from "@shared/designSystem";
import { Text, HStack, Button, TextField } from "@shared/ui";

interface Props {
  visible: boolean;
  /** Whatever was typed into the picker — the name, usually. */
  initialName?: string;
  loading?: boolean;
  /** Server-side failure, e.g. the 409 for a mobile already on file. */
  error?: string | null;
  onSubmit: (values: { name: string; mobile: string }) => void;
  onCancel: () => void;
}

/**
 * Exactly what the server accepts (customer.validation.js): 7-15 digits with an
 * optional leading +. Deliberately not an India-only 10-digit rule — the server
 * takes landlines and country codes, and a client that refuses what the API
 * would have stored is just a bug the operator cannot argue with.
 */
const MOBILE = /^\+?[0-9]{7,15}$/;

export function NewCustomerDialog({
  visible,
  initialName = "",
  loading,
  error,
  onSubmit,
  onCancel,
}: Props) {
  const [name, setName] = useState(initialName);
  const [mobile, setMobile] = useState("");
  const [touched, setTouched] = useState<{ name?: string; mobile?: string }>(
    {},
  );

  // Reset on open, during render rather than in an effect.
  const [wasVisible, setWasVisible] = useState(visible);
  if (visible !== wasVisible) {
    setWasVisible(visible);
    if (visible) {
      setName(initialName);
      setMobile("");
      setTouched({});
    }
  }

  const submit = () => {
    const cleanName = name.trim();
    const cleanMobile = mobile.replace(/[\s-]/g, "").trim();

    const next: typeof touched = {};
    if (!cleanName) next.name = "A name is required";
    // Only validate the number if one was actually given.
    if (cleanMobile && !MOBILE.test(cleanMobile))
      next.mobile = "Enter a valid number — 7 to 15 digits";
    setTouched(next);
    if (Object.keys(next).length) return;

    onSubmit({ name: cleanName, mobile: cleanMobile });
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
    >
      <Pressable
        style={styles.overlay}
        onPress={loading ? undefined : onCancel}
      >
        <Pressable style={styles.card} onPress={() => {}}>
          <Text variant="h3" tone="primary">
            New customer
          </Text>
          <Text variant="body-sm" tone="secondary" style={{ marginTop: 6 }}>
            The mobile number is what a refill reminder goes to, and how you
            find them next time. You can leave it blank.
          </Text>

          <View style={{ marginTop: 16, gap: 12 }}>
            <TextField
              label="Name"
              value={name}
              onChangeText={(t) => {
                setName(t);
                if (touched.name)
                  setTouched((c) => ({ ...c, name: undefined }));
              }}
              placeholder="Customer name"
              autoCapitalize="words"
              autoFocus
              leading={
                <User
                  size={18}
                  color={palette.text.tertiary}
                  strokeWidth={1.8}
                />
              }
              error={touched.name}
            />
            <TextField
              label="Mobile (optional)"
              value={mobile}
              onChangeText={(t) => {
                setMobile(t);
                if (touched.mobile)
                  setTouched((c) => ({ ...c, mobile: undefined }));
              }}
              placeholder="98765 43210"
              keyboardType="phone-pad"
              autoCapitalize="none"
              leading={
                <Phone
                  size={18}
                  color={palette.text.tertiary}
                  strokeWidth={1.8}
                />
              }
              error={touched.mobile}
              onSubmitEditing={submit}
            />
          </View>

          {error ? (
            <Text variant="body-sm" tone="danger" style={{ marginTop: 12 }}>
              {error}
            </Text>
          ) : null}

          <HStack gap={10} justify="flex-end" style={{ marginTop: 20 }}>
            <Button
              label="Cancel"
              variant="secondary"
              fullWidth={false}
              disabled={loading}
              onPress={onCancel}
            />
            <Button
              label="Add customer"
              fullWidth={false}
              loading={loading}
              onPress={submit}
            />
          </HStack>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(15,23,42,0.45)",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  card: {
    width: "100%",
    maxWidth: 420,
    backgroundColor: palette.surface.primary,
    borderRadius: radius.xl,
    padding: 20,
    ...shadows.lg,
  },
});
