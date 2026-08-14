/**
 * Home-only "scan to sell" control.
 *
 * On a phone the fastest possible sale is: pick up the pack, point the camera,
 * take the money — worth a shortcut on the home screen.
 *
 * NO LONGER A FLOATING CIRCLE. Once the bottom tab bar arrived, a FAB pinned
 * above it landed squarely on the row actions in "Needs attention" — a green
 * disc sitting on top of the "Reorder" button is a mis-tap waiting to happen,
 * and Material 3 reserves the FAB for the primary action *of a screen* rather
 * than a control that follows you around. It renders inline in the dashboard's
 * action row instead: always visible, never over anything.
 *
 * Rendered BY the Dashboard, not by the navigator. It used to render app-wide,
 * which the audit reported twice over: it covered content on Receive Stock and
 * Receipt history, and tapping it there did nothing useful.
 *
 * Deliberately not solved by asking "which screen am I on?" — two attempts at
 * reading the focused route returned the shell's name rather than the page's
 * and hid the button everywhere, Home included. Letting the one screen that
 * wants it render it cannot misfire.
 *
 * Tapping asks which camera, because the two do different jobs and the app
 * cannot guess: a barcode scanner reads the printed EAN, while the pack reader
 * photographs the panel and reads the batch number as text — the case where a
 * strip has no barcode at all.
 */
import React, { useState } from "react";
import {
  View,
  Pressable,
  Modal,
  StyleSheet,
  useWindowDimensions,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { ScanLine, ScanText, X } from "lucide-react-native";
import { useAuthStore } from "@shared/store/useAuthStore";
import { PERMISSIONS } from "@shared/permissions";
import { palette, layout, radius } from "@shared/designSystem";
import { Text, VStack, HStack } from "@shared/ui";

export function ScanFab() {
  const { width } = useWindowDimensions();
  const navigation = useNavigation<never>();
  const [asking, setAsking] = useState(false);
  const canSell = useAuthStore((s) => s.hasPermission)(
    PERMISSIONS.SALES_MANAGE,
  );

  // Desktop has the sidebar and a barcode gun; this would just be in the way.
  if (width >= layout.wideBreakpoint || !canSell) return null;

  /** `mode` picks which camera New Sale opens with. */
  const go = (mode: "qr" | "pack") => {
    setAsking(false);
    // @ts-expect-error nested navigator params
    navigation.navigate("Sales", {
      screen: "NewSale",
      params: { autoScan: mode },
    });
  };

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Scan a pack to start a sale"
        onPress={() => setAsking(true)}
        style={({ pressed }) => [styles.trigger, pressed && { opacity: 0.85 }]}
      >
        <ScanLine size={15} color="#FFFFFF" strokeWidth={2.2} />
        <Text variant="label" style={styles.label}>
          Scan to sell
        </Text>
      </Pressable>

      <Modal
        visible={asking}
        transparent
        animationType="fade"
        onRequestClose={() => setAsking(false)}
      >
        <Pressable style={styles.backdrop} onPress={() => setAsking(false)}>
          <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
            <HStack align="center" justify="space-between">
              <Text variant="label-lg" tone="primary">
                What are you scanning?
              </Text>
              <Pressable
                onPress={() => setAsking(false)}
                hitSlop={10}
                accessibilityRole="button"
                accessibilityLabel="Close"
              >
                <X size={20} color={palette.text.tertiary} strokeWidth={2} />
              </Pressable>
            </HStack>

            <Choice
              icon={
                <ScanLine size={22} color={palette.teal[700]} strokeWidth={2} />
              }
              title="QR / barcode"
              sub="The printed barcode on the pack"
              onPress={() => go("qr")}
              label="Scan a QR code or barcode"
            />
            <Choice
              icon={
                <ScanText size={22} color={palette.teal[700]} strokeWidth={2} />
              }
              title="Batch number"
              sub="Reads the printed panel when there is no barcode"
              onPress={() => go("pack")}
              label="Read the batch number from the pack"
            />
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

function Choice({
  icon,
  title,
  sub,
  onPress,
  label,
}: {
  icon: React.ReactNode;
  title: string;
  sub: string;
  onPress: () => void;
  label: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [styles.choice, pressed && styles.choicePressed]}
    >
      <HStack gap={12} align="center">
        <View style={styles.choiceIcon}>{icon}</View>
        <VStack gap={2} flex={1}>
          <Text variant="label-lg" tone="primary">
            {title}
          </Text>
          <Text variant="body-sm" tone="tertiary">
            {sub}
          </Text>
        </VStack>
      </HStack>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  /**
   * An ordinary button in the dashboard's action row. The floating variant and
   * its bottom-anchored SafeAreaView are gone — see the note at the top.
   */
  trigger: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    minHeight: 44,
    paddingHorizontal: 14,
    borderRadius: radius.md,
    backgroundColor: palette.teal[700],
    alignSelf: "flex-start",
  },
  label: { color: "#FFFFFF", marginTop: 1 },
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(7,26,16,0.45)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: palette.surface.primary,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    padding: 20,
    paddingBottom: 34,
    gap: 12,
  },
  choice: {
    borderWidth: 1,
    borderColor: palette.border.default,
    borderRadius: radius.md,
    padding: 14,
  },
  choicePressed: { backgroundColor: palette.teal[50] },
  choiceIcon: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: palette.teal[50],
    alignItems: "center",
    justifyContent: "center",
  },
});
