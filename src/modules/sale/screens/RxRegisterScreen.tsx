/**
 * Schedule H / H1 register — the book the drug inspector asks for.
 *
 * Rule 65 of the Drugs & Cosmetics Rules: every Schedule H1 supply recorded
 * with the prescriber's name and address, the patient's name and address,
 * the drug and the quantity, kept three years. Built from the sales
 * themselves (each line snapshots its schedule at sale time), joined to the
 * prescription for the prescriber's registration number.
 */
import React, { useState } from "react";
import { Platform, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { Download, ClipboardList } from "lucide-react-native";
import {
  prescriptionApi,
  RxRegisterRow,
} from "@modules/sale/api/prescriptionApi";
import { apiErrorMessage } from "@api/apiClient";
import { fmtDate } from "@shared/format";
import {
  Screen,
  Text,
  VStack,
  HStack,
  Card,
  Button,
  ChipsRow,
  TextField,
  DataTable,
  Column,
  Pagination,
  Skeleton,
  ErrorState,
  EmptyState,
  StatusChip,
} from "@shared/ui";

const monthAgo = () => {
  const d = new Date();
  d.setMonth(d.getMonth() - 1);
  return d.toISOString().slice(0, 10);
};

function toCsv(rows: RxRegisterRow[]): string {
  const cols = [
    "Date",
    "Bill No",
    "Patient",
    "Patient address",
    "Age",
    "Prescriber",
    "Reg no",
    "Prescriber address",
    "Drug",
    "Schedule",
    "Qty",
    "Unit",
    "Batch",
    "Sold by",
  ];
  const cell = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const lines = rows.map((r) =>
    [
      fmtDate(r.date),
      r.invoiceNo,
      r.patientName,
      r.patientAddress,
      r.patientAge,
      r.doctorName,
      r.doctorRegNo,
      r.doctorAddress,
      r.drug,
      r.schedule,
      r.quantity,
      r.unit,
      r.batchNumber,
      r.soldBy,
    ]
      .map(cell)
      .join(","),
  );
  return [cols.map(cell).join(","), ...lines].join("\r\n");
}

export default function RxRegisterScreen() {
  const [from, setFrom] = useState(monthAgo());
  const [to, setTo] = useState(new Date().toISOString().slice(0, 10));
  const [schedule, setSchedule] = useState<string>("");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(100);

  const q = useQuery({
    queryKey: ["rx-register", from, to, schedule, page],
    queryFn: () =>
      prescriptionApi.register({
        from: from || undefined,
        to: to || undefined,
        schedule: (schedule || undefined) as "H" | "H1" | "X" | undefined,
        page,
        limit,
      }),
  });

  const rows = q.data?.data ?? [];

  const exportCsv = () => {
    if (Platform.OS !== "web" || typeof document === "undefined") return;
    const blob = new Blob([toCsv(rows)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `schedule-${schedule || "H"}-register-${from}-to-${to}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
  };

  const columns: Column<RxRegisterRow>[] = [
    {
      key: "date",
      header: "Date",
      width: 100,
      render: (r) => <Text variant="body-sm">{fmtDate(r.date)}</Text>,
    },
    {
      key: "invoiceNo",
      header: "Bill",
      width: 120,
      render: (r) => <Text variant="label-sm">{r.invoiceNo}</Text>,
    },
    {
      key: "patient",
      header: "Patient",
      render: (r) => (
        <VStack gap={1}>
          <Text variant="body-sm" numberOfLines={1}>
            {r.patientName}
            {r.patientAge ? ` (${r.patientAge})` : ""}
          </Text>
          <Text variant="caption" tone="tertiary" numberOfLines={1}>
            {r.patientAddress || "—"}
          </Text>
        </VStack>
      ),
    },
    {
      key: "doctor",
      header: "Prescriber",
      render: (r) => (
        <VStack gap={1}>
          <Text variant="body-sm" numberOfLines={1}>
            {r.doctorName || "—"}
          </Text>
          <Text variant="caption" tone="tertiary" numberOfLines={1}>
            {[r.doctorRegNo, r.doctorAddress].filter(Boolean).join(" · ") ||
              "—"}
          </Text>
        </VStack>
      ),
    },
    {
      key: "drug",
      header: "Drug",
      render: (r) => (
        <HStack gap={6} align="center">
          <Text variant="body-sm" numberOfLines={1} style={{ flexShrink: 1 }}>
            {r.drug}
          </Text>
          {r.schedule ? (
            <StatusChip
              tone={r.schedule === "X" ? "danger" : "warning"}
              label={r.schedule}
            />
          ) : null}
        </HStack>
      ),
    },
    {
      key: "qty",
      header: "Qty",
      width: 90,
      render: (r) => (
        <Text variant="body-sm">
          {r.quantity} {r.unit}
        </Text>
      ),
    },
    {
      key: "batch",
      header: "Batch",
      width: 110,
      render: (r) => <Text variant="body-sm">{r.batchNumber || "—"}</Text>,
    },
    {
      key: "rx",
      header: "Rx",
      width: 90,
      render: (r) =>
        r.prescriptionId ? (
          <StatusChip
            tone={r.prescriptionStatus === "verified" ? "success" : "warning"}
            label={r.prescriptionStatus}
          />
        ) : (
          <Text variant="caption" tone="danger">
            none
          </Text>
        ),
    },
  ];

  return (
    <Screen
      title="Prescription register"
      subtitle="Schedule H / H1 / X sales with prescriber and patient — Rule 65"
      right={
        Platform.OS === "web" ? (
          <Button
            label="Export CSV"
            variant="secondary"
            size="sm"
            fullWidth={false}
            disabled={!rows.length}
            icon={<Download size={16} strokeWidth={2} />}
            onPress={exportCsv}
          />
        ) : undefined
      }
    >
      <Card style={{ marginBottom: 12 }}>
        <VStack gap={10}>
          <HStack gap={10}>
            <View style={{ flex: 1 }}>
              <TextField
                label="From"
                value={from}
                onChangeText={(v) => {
                  setFrom(v);
                  setPage(1);
                }}
                placeholder="YYYY-MM-DD"
              />
            </View>
            <View style={{ flex: 1 }}>
              <TextField
                label="To"
                value={to}
                onChangeText={(v) => {
                  setTo(v);
                  setPage(1);
                }}
                placeholder="YYYY-MM-DD"
              />
            </View>
          </HStack>
          <ChipsRow
            chips={[
              { key: "", label: "All Rx" },
              { key: "H", label: "Schedule H" },
              { key: "H1", label: "Schedule H1" },
              { key: "X", label: "Schedule X" },
            ]}
            active={schedule}
            onChange={(k) => {
              setSchedule(k);
              setPage(1);
            }}
          />
        </VStack>
      </Card>

      {q.isError ? (
        <ErrorState
          error={q.error}
          title="Couldn't load the register"
          message={apiErrorMessage(q.error)}
        />
      ) : q.isLoading ? (
        <VStack gap={8}>
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} height={44} />
          ))}
        </VStack>
      ) : rows.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title="No scheduled-drug sales in this range"
          message="Sales of Schedule H, H1 and X items appear here with their prescriptions."
        />
      ) : (
        <>
          <DataTable
            columns={columns}
            rows={rows}
            keyExtractor={(r, i) => `${r.saleId}-${r.drug}-${i}`}
          />
          <Pagination
            page={q.data?.meta.page ?? 1}
            totalPages={q.data?.meta.pages ?? 1}
            total={q.data?.meta.total ?? 0}
            limit={limit}
            onPageChange={setPage}
            onLimitChange={(l) => {
              setLimit(l);
              setPage(1);
            }}
            pageSizes={[50, 100, 200]}
            label="entries"
          />
        </>
      )}
    </Screen>
  );
}
