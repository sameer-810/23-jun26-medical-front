import React, { useEffect, useState } from "react";
import { View } from "react-native";
import { Ruler } from "lucide-react-native";
import { Select, SelectOption } from "@shared/ui/Select";
import { Button } from "@shared/ui/Button";
import { PromptDialog } from "@shared/ui/PromptDialog";
import { Text } from "@shared/ui/Text";
import { HStack } from "@shared/ui/Stack";
import { palette } from "@shared/designSystem";
import {
  listPrinters,
  getLabelPrinter,
  setLabelPrinter,
  getLabelScale,
  setLabelScale,
} from "@shared/print";
import {
  printCalibrationLabel,
  CALIBRATION_BAR_MM,
} from "@modules/inventory/label";

/**
 * Label printing setup, at the point where labels get printed.
 *
 * Two separate problems, which is why there are two controls:
 *
 *   WHICH printer — desktop only. A counter PC normally has an A4 printer as
 *     the Windows default and the thermal one beside it, so silent printing has
 *     to be told which is which.
 *   WHAT SIZE it comes out — everywhere, and the one that actually bit us. A
 *     browser cannot be stopped from scaling a print job to fit its idea of the
 *     printable area, and the client's first run came out at about half size,
 *     which puts the barcode under what a 203dpi head can resolve. So instead
 *     of arguing with the print dialog we measure the finished sticker and
 *     correct by the difference.
 */
export function LabelPrintSettings() {
  const [printers, setPrinters] = useState<SelectOption[] | null>(null);
  const [printer, setPrinter] = useState<string | null>(
    getLabelPrinter() ?? null,
  );
  const [asking, setAsking] = useState(false);
  const [scale, setScale] = useState(getLabelScale());

  useEffect(() => {
    let alive = true;
    void listPrinters().then((found) => {
      if (!alive) return;
      setPrinters(
        found.map((p) => ({
          value: p.name,
          label: (p.displayName || p.name) + (p.isDefault ? "  (default)" : ""),
        })),
      );
    });
    return () => {
      alive = false;
    };
  }, []);

  const startTest = () => {
    void printCalibrationLabel();
    // Ask only after the sticker is on its way — there is nothing to measure
    // until it has come out of the printer.
    setAsking(true);
  };

  const applyMeasurement = (raw: string) => {
    const measured = Number(raw.replace(",", "."));
    setAsking(false);
    if (!Number.isFinite(measured) || measured <= 0) return;
    // The bar is authored at CALIBRATION_BAR_MM and was printed through the
    // current `scale`. If it came out short, the pipeline is shrinking by
    // measured/BAR, so the correction multiplies the scale by its inverse.
    const next = (scale * CALIBRATION_BAR_MM) / measured;
    setLabelScale(next);
    setScale(getLabelScale());
  };

  const off = Math.abs(scale - 1) > 0.005;

  return (
    <HStack gap={8} align="center" wrap>
      {/* Desktop only: a browser has no printer list to offer. */}
      {printers?.length ? (
        <View style={{ minWidth: 190 }}>
          <Select
            label="Label printer"
            placeholder="System default"
            value={printer}
            options={printers}
            allowClear
            onChange={(next) => {
              setPrinter(next);
              setLabelPrinter(next);
            }}
          />
        </View>
      ) : null}

      <Button
        label={off ? "Re-check label size" : "Check label size"}
        variant="secondary"
        fullWidth={false}
        onPress={startTest}
        icon={<Ruler size={15} color={palette.text.primary} strokeWidth={2} />}
      />

      {off ? (
        <Text variant="caption" tone="secondary">
          Size corrected by {Math.round(scale * 100)}%
        </Text>
      ) : null}

      <PromptDialog
        visible={asking}
        title="Measure the test label"
        message={`A test sticker has been sent to the printer. Measure the black bar on it with a ruler and enter its length. It should be ${CALIBRATION_BAR_MM} mm — if it isn't, every label will be resized to match from now on.`}
        label={`Measured length (mm)`}
        placeholder={String(CALIBRATION_BAR_MM)}
        keyboardType="decimal-pad"
        confirmLabel="Apply"
        validate={(v) => {
          const n = Number(v.replace(",", "."));
          if (!Number.isFinite(n) || n <= 0) return "Enter the length in mm.";
          // Outside this the wrong thing was measured — the label itself, say,
          // or inches — and applying it would make the next print far worse.
          if (n < CALIBRATION_BAR_MM / 3 || n > CALIBRATION_BAR_MM * 2) {
            return `That is a long way from ${CALIBRATION_BAR_MM} mm — measure just the black bar.`;
          }
          return null;
        }}
        onSubmit={applyMeasurement}
        onCancel={() => setAsking(false)}
      />
    </HStack>
  );
}
