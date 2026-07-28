import React, { useState } from "react";
import { View } from "react-native";
import { ScrollText } from "lucide-react-native";
import { useAudit } from "@modules/admin/hooks/useAdmin";
import { AdminNav } from "@modules/admin/components/AdminNav";
import {
  Screen,
  Text,
  VStack,
  HStack,
  Card,
  StatusChip,
  Pagination,
  EmptyState,
} from "@shared/ui";

export default function AuditScreen() {
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(30);
  const { data, isLoading } = useAudit({ page, limit });
  const items = data?.data ?? [];
  const meta = data?.meta;

  return (
    <Screen overline="Platform" title="Audit log">
      <AdminNav active="audit" />

      {items.length === 0 ? (
        <EmptyState
          icon={ScrollText}
          title={isLoading ? "Loading…" : "No activity yet"}
        />
      ) : (
        <VStack gap={8}>
          {items.map((a) => (
            <Card key={a._id}>
              <VStack gap={6}>
                <HStack gap={10} align="center" justify="space-between">
                  <StatusChip label={a.action} tone="info" />
                  <Text variant="caption" tone="tertiary">
                    {new Date(a.createdAt).toLocaleString("en-IN")}
                  </Text>
                </HStack>
                {a.description ? (
                  <Text variant="body-sm" tone="primary">
                    {a.description}
                  </Text>
                ) : null}
                <Text variant="caption" tone="tertiary" numberOfLines={1}>
                  {a.adminEmail} · {a.entityType}
                  {a.ip ? ` · ${a.ip}` : ""}
                </Text>
              </VStack>
            </Card>
          ))}
        </VStack>
      )}

      {meta && meta.total > 0 ? (
        <View style={{ marginTop: 16 }}>
          <Pagination
            page={meta.page}
            totalPages={meta.totalPages}
            total={meta.total}
            limit={meta.limit}
            onPageChange={setPage}
            onLimitChange={(l) => {
              setLimit(l);
              setPage(1);
            }}
            label="events"
          />
        </View>
      ) : null}
    </Screen>
  );
}
