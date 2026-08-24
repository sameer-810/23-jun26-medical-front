/**
 * Offline & Sync — the review desk for offline billing (Phase 3).
 *
 * Two lists, two different truths:
 *  - THIS device's outbox: bills captured offline, waiting or parked. A
 *    parked bill was judged by the server; a human decides retry or discard
 *    (the goods left either way — discarding only abandons the record).
 *  - The shop's recount tasks: cells the server drove negative to honour a
 *    replayed bill. "Resolve" acknowledges; actual counts are corrected
 *    through the ordinary adjustment flow so the ledger stays honest.
 */
import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Inbox, PackageCheck, CloudOff } from "lucide-react-native";
import {
  Screen,
  Text,
  Button,
  Banner,
  Card,
  SectionHeader,
  StatusChip,
  EmptyState,
  ConfirmDialog,
  HStack,
  VStack,
} from "@shared/ui";
import { fmtMoney, fmtDate } from "@shared/format";
import { apiErrorMessage } from "@api/apiClient";
import {
  useOfflineStore,
  useQueueCounts,
  OutboxOp,
} from "@shared/offline/useOfflineStore";
import { requestSync } from "@shared/offline/outboxEngine";
import {
  reconciliationApi,
  ReconciliationTask,
} from "@modules/sale/api/reconciliationApi";

function opTitle(op: OutboxOp) {
  const bill = op.displayNo ? `Bill ${op.displayNo}` : "Unnumbered bill";
  const items = op.itemCount
    ? ` · ${op.itemCount} item${op.itemCount === 1 ? "" : "s"}`
    : "";
  const total = op.totalAmount ? ` · ${fmtMoney(op.totalAmount)}` : "";
  return `${bill}${items}${total}`;
}

export default function OfflineSyncScreen() {
  const online = useOfflineStore((s) => s.online);
  const ops = useOfflineStore((s) => s.ops);
  const { pending, failed } = useQueueCounts();
  const retry = useOfflineStore((s) => s.retry);
  const remove = useOfflineStore((s) => s.remove);
  const [confirmDiscard, setConfirmDiscard] = useState<OutboxOp | null>(null);
  const [syncing, setSyncing] = useState(false);
  const qc = useQueryClient();

  const tasks = useQuery({
    queryKey: ["reconciliation", "open"],
    queryFn: () => reconciliationApi.list({ status: "open", limit: 50 }),
    enabled: online,
  });

  const resolveMut = useMutation({
    mutationFn: (id: string) => reconciliationApi.resolve(id),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ["reconciliation", "open"] }),
  });

  const syncNow = async () => {
    setSyncing(true);
    try {
      await requestSync();
    } finally {
      setSyncing(false);
    }
  };

  return (
    <Screen
      title="Offline & sync"
      subtitle="Bills waiting to reach the server, and shelves to recount"
      right={
        <Button
          label={syncing ? "Syncing…" : "Sync now"}
          variant="secondary"
          disabled={syncing || !online}
          onPress={() => void syncNow()}
        />
      }
    >
      <Banner
        tone={online ? "success" : "warning"}
        message={
          online
            ? "Connected — bills sync automatically."
            : "Offline — billing continues; everything below syncs when the connection returns."
        }
        style={{ marginBottom: 16 }}
      />

      <SectionHeader title="This device's queue" count={pending + failed} />
      {ops.length === 0 ? (
        <EmptyState
          icon={Inbox}
          title="Nothing waiting"
          message="Bills made offline appear here until they reach the server."
        />
      ) : (
        <VStack gap={8} style={{ marginBottom: 20 }}>
          {ops.map((op) => (
            <Card key={op.opId}>
              <HStack align="center" gap={10}>
                <VStack gap={2} style={{ flex: 1 }}>
                  <Text variant="label">{opTitle(op)}</Text>
                  <Text variant="body-sm" tone="secondary">
                    {op.customerName || "Walk-in"} · {fmtDate(op.createdAt)}
                    {op.attempts > 0
                      ? ` · ${op.attempts} attempt${op.attempts === 1 ? "" : "s"}`
                      : ""}
                  </Text>
                  {op.status === "failed" && op.lastError ? (
                    <Text variant="body-sm" tone="danger">
                      {op.lastError}
                    </Text>
                  ) : null}
                </VStack>
                <StatusChip
                  tone={op.status === "failed" ? "danger" : "info"}
                  label={op.status === "failed" ? "Needs review" : "Waiting"}
                />
              </HStack>
              {op.status === "failed" ? (
                <HStack gap={8} style={{ marginTop: 10 }}>
                  <Button
                    label="Retry"
                    variant="secondary"
                    size="sm"
                    onPress={() => {
                      retry(op.opId);
                      void syncNow();
                    }}
                  />
                  <Button
                    label="Discard"
                    variant="ghost"
                    size="sm"
                    onPress={() => setConfirmDiscard(op)}
                  />
                </HStack>
              ) : null}
            </Card>
          ))}
        </VStack>
      )}

      <SectionHeader
        title="Stock to recount"
        count={tasks.data?.meta?.total ?? undefined}
      />
      {!online ? (
        <EmptyState
          icon={CloudOff}
          title="Unavailable offline"
          message="Recount tasks load when the connection returns."
        />
      ) : tasks.isError ? (
        <Banner tone="danger" message={apiErrorMessage(tasks.error)} />
      ) : (tasks.data?.data?.length ?? 0) === 0 ? (
        <EmptyState
          icon={PackageCheck}
          title="Nothing to recount"
          message="When an offline bill oversells a batch, the shelf to recount is listed here."
        />
      ) : (
        <VStack gap={8}>
          {(tasks.data?.data ?? []).map((t: ReconciliationTask) => (
            <Card key={t.id}>
              <HStack align="center" gap={10}>
                <VStack gap={2} style={{ flex: 1 }}>
                  <Text variant="label">
                    {t.productName}
                    {t.batchNumber ? ` · lot ${t.batchNumber}` : ""}
                  </Text>
                  <Text variant="body-sm" tone="secondary">
                    Sold {t.qtyShort} more than the system had
                    {t.invoiceNo ? ` (${t.invoiceNo})` : ""} ·{" "}
                    {fmtDate(t.createdAt)}
                  </Text>
                  <Text variant="body-sm" tone="tertiary">
                    Count the shelf, correct via Adjustments, then resolve.
                  </Text>
                </VStack>
                <Button
                  label="Resolve"
                  variant="secondary"
                  size="sm"
                  loading={
                    resolveMut.isPending && resolveMut.variables === t.id
                  }
                  onPress={() => resolveMut.mutate(t.id)}
                />
              </HStack>
            </Card>
          ))}
          {resolveMut.isError ? (
            <Banner tone="danger" message={apiErrorMessage(resolveMut.error)} />
          ) : null}
        </VStack>
      )}

      <ConfirmDialog
        visible={confirmDiscard != null}
        title="Discard this bill?"
        message={
          confirmDiscard
            ? `${opTitle(confirmDiscard)} will be permanently dropped and never reach the server. If it was printed, its number stays used — note the gap for GST records.`
            : ""
        }
        confirmLabel="Discard bill"
        destructive
        onConfirm={() => {
          if (confirmDiscard) remove(confirmDiscard.opId);
          setConfirmDiscard(null);
        }}
        onCancel={() => setConfirmDiscard(null)}
      />
    </Screen>
  );
}
