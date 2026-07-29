import React, { useState } from "react";
import { View, Image, StyleSheet } from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import { useQuery, useMutation } from "@tanstack/react-query";
import { ArrowLeft, PlusCircle, CheckCircle2 } from "lucide-react-native";
import { medguideApi } from "@modules/medguide/api/medguideApi";
import type { Medicine } from "@modules/medguide/types";
import { useAuthStore } from "@shared/store/useAuthStore";
import { PERMISSIONS } from "@shared/permissions";
import { apiErrorMessage } from "@api/apiClient";
import { palette, radius } from "@shared/designSystem";
import {
  Screen,
  Text,
  VStack,
  HStack,
  Card,
  Button,
  StatusChip,
  Skeleton,
} from "@shared/ui";

// Some source fields carry inline HTML (<p>, <br>) — flatten to plain text.
const clean = (s?: string) =>
  (s || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

function Section({ title, body }: { title: string; body?: string }) {
  const text = clean(body);
  if (!text) return null;
  return (
    <Card>
      <VStack gap={6}>
        <Text variant="label-lg" tone="primary">
          {title}
        </Text>
        <Text variant="body-sm" tone="secondary" style={{ lineHeight: 20 }}>
          {text}
        </Text>
      </VStack>
    </Card>
  );
}

function Chips({ title, items }: { title: string; items: string[] }) {
  if (!items?.length) return null;
  return (
    <Card>
      <VStack gap={8}>
        <Text variant="label-lg" tone="primary">
          {title}
        </Text>
        <HStack gap={6} style={{ flexWrap: "wrap" }}>
          {items.map((it, i) => (
            <StatusChip key={i} label={it} tone="neutral" />
          ))}
        </HStack>
      </VStack>
    </Card>
  );
}

export default function MedicineDetailScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const id = route.params?.id as string;

  const { data: m, isLoading } = useQuery<Medicine>({
    queryKey: ["medguide", "item", id],
    queryFn: () => medguideApi.get(id),
    enabled: Boolean(id),
  });

  const canManage = useAuthStore((s) =>
    s.hasPermission(PERMISSIONS.PRODUCTS_MANAGE),
  );
  const [notice, setNotice] = useState<string | null>(null);
  const addMut = useMutation({
    mutationFn: () => medguideApi.addToStore(id),
    onSuccess: (p) => setNotice(`Added "${p.name}" to your store.`),
    onError: (err) => setNotice(apiErrorMessage(err)),
  });

  const info = m?.medicineInfo;
  const inter = info?.interactions;
  const interRows = inter
    ? [
        ["Alcohol", inter.alcohol],
        ["Pregnancy", inter.pregnancy],
        ["Breastfeeding", inter.lactation],
        ["Driving", inter.driving],
        ["Kidney", inter.kidney],
        ["Liver", inter.liver],
      ].filter(([, v]) => clean(v))
    : [];

  return (
    <Screen
      overline="MedGuide"
      title={m?.name || "Medicine"}
      right={
        <Button
          label="Back"
          size="sm"
          variant="secondary"
          icon={
            <ArrowLeft
              size={16}
              color={palette.text.secondary}
              strokeWidth={2}
            />
          }
          onPress={() => navigation.goBack()}
        />
      }
    >
      {!m ? (
        isLoading ? (
          <VStack gap={12}>
            <Card>
              <HStack gap={14} align="center">
                <Skeleton width={72} height={72} rounded="md" />
                <VStack gap={8} flex={1}>
                  <Skeleton width="60%" height={14} />
                  <Skeleton width="45%" height={14} />
                  <Skeleton width={80} height={22} rounded="full" />
                </VStack>
              </HStack>
            </Card>
            {[0, 1, 2].map((i) => (
              <Card key={i}>
                <VStack gap={8}>
                  <Skeleton width="35%" height={16} />
                  <Skeleton width="90%" height={12} />
                  <Skeleton width="80%" height={12} />
                </VStack>
              </Card>
            ))}
          </VStack>
        ) : (
          <Text variant="body-sm" tone="tertiary">
            Medicine not found.
          </Text>
        )
      ) : (
        <VStack gap={12}>
          <Card>
            <HStack gap={14} align="center">
              {m.images?.[0] ? (
                <Image source={{ uri: m.images[0] }} style={styles.thumb} />
              ) : null}
              <VStack gap={4} flex={1}>
                <Text variant="body-sm" tone="tertiary">
                  {m.saltComposition || "—"}
                </Text>
                <Text variant="body-sm" tone="secondary">
                  {m.manufacturerName || "—"}
                  {m.packLabel ? ` · ${m.packLabel}` : ""}
                </Text>
                <HStack gap={6} align="center" style={{ marginTop: 2 }}>
                  <StatusChip label={`₹${m.mrp}`} tone="success" />
                  {m.prescriptionRequired ? (
                    <StatusChip label="Prescription" tone="warning" />
                  ) : null}
                </HStack>
              </VStack>
            </HStack>
          </Card>

          {canManage ? (
            <Button
              label="Add to my store"
              icon={<PlusCircle size={16} color="#FFFFFF" strokeWidth={2} />}
              loading={addMut.isPending}
              onPress={() => {
                setNotice(null);
                addMut.mutate();
              }}
            />
          ) : null}
          {notice ? (
            <View style={styles.notice}>
              <CheckCircle2
                size={16}
                color={palette.success.text}
                strokeWidth={2}
              />
              <Text variant="body-sm" tone="secondary" style={{ flex: 1 }}>
                {notice}
              </Text>
            </View>
          ) : null}

          <Chips title="Uses" items={m.uses} />
          <Section title="Overview" body={info?.introduction} />
          <Section title="Benefits" body={info?.benefits} />
          <Section title="How to use" body={info?.howToUse} />
          <Section title="How it works" body={info?.howItWorks} />
          <Chips title="Side effects" items={m.sideEffects} />

          {interRows.length > 0 ? (
            <Card>
              <VStack gap={8}>
                <Text variant="label-lg" tone="primary">
                  Interactions & warnings
                </Text>
                {interRows.map(([k, v]) => (
                  <HStack key={k} gap={10} justify="space-between">
                    <Text variant="body-sm" tone="tertiary">
                      {k}
                    </Text>
                    <Text
                      variant="body-sm"
                      tone="secondary"
                      style={{ flex: 1, textAlign: "right" }}
                    >
                      {clean(v)}
                    </Text>
                  </HStack>
                ))}
              </VStack>
            </Card>
          ) : null}

          <Section title="Safety advice" body={info?.safetyAdvice} />
          <Section title="If you miss a dose" body={info?.ifMissed} />
          <Section title="Storage" body={info?.storage} />
          <Chips title="Substitutes" items={m.substitutes} />

          {m.drugClass &&
          (m.drugClass.therapeutic ||
            m.drugClass.action ||
            m.drugClass.chemical) ? (
            <Card>
              <VStack gap={6}>
                <Text variant="label-lg" tone="primary">
                  Classification
                </Text>
                {m.drugClass.therapeutic ? (
                  <Text variant="body-sm" tone="secondary">
                    Therapeutic: {m.drugClass.therapeutic}
                  </Text>
                ) : null}
                {m.drugClass.action ? (
                  <Text variant="body-sm" tone="secondary">
                    Action: {m.drugClass.action}
                  </Text>
                ) : null}
                {m.drugClass.habitForming ? (
                  <Text variant="body-sm" tone="secondary">
                    Habit forming: {m.drugClass.habitForming}
                  </Text>
                ) : null}
              </VStack>
            </Card>
          ) : null}

          <Section title="FAQ" body={info?.faq} />

          <Text variant="caption" tone="tertiary" style={{ marginTop: 4 }}>
            Reference information only — always follow medical advice.
          </Text>
        </VStack>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  thumb: {
    width: 72,
    height: 72,
    borderRadius: radius.md,
    backgroundColor: palette.ink[100],
  },
  notice: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 12,
    borderRadius: radius.md,
    backgroundColor: palette.success.bg,
    borderWidth: 1,
    borderColor: palette.success.border,
  },
});
