import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { chequeApi } from "@modules/cheque/api/chequeApi";
import { ChequePayload, ChequeStatus } from "@modules/cheque/types";

const KEY = ["cheques"];

export function useCheques(params?: {
  direction?: string;
  status?: string;
  page?: number;
  limit?: number;
}) {
  return useQuery({
    queryKey: [...KEY, params],
    queryFn: () => chequeApi.list(params),
  });
}

export function useUpcomingPdc() {
  return useQuery({
    queryKey: [...KEY, "upcoming"],
    queryFn: () => chequeApi.upcoming(),
  });
}

function useInvalidate() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: KEY });
    qc.invalidateQueries({ queryKey: ["dashboard", "finance"] });
  };
}

export function useCreateCheque() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (payload: ChequePayload) => chequeApi.create(payload),
    onSuccess: invalidate,
  });
}

export function useSetChequeStatus() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: ChequeStatus }) =>
      chequeApi.setStatus(id, status),
    onSuccess: invalidate,
  });
}

export function useRemoveCheque() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (id: string) => chequeApi.remove(id),
    onSuccess: invalidate,
  });
}
