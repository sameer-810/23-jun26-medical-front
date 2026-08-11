export type ReminderPriority = "low" | "normal" | "high";
export type ReminderStatus = "pending" | "done";

export interface Reminder {
  id: string;
  title: string;
  notes: string;
  dueAt: string;
  priority: ReminderPriority;
  status: ReminderStatus;
  completedAt: string | null;
  isOverdue: boolean;
  createdAt: string;
  /** Who to ring. Carried as data so the list can dial, not just display. */
  customerId: string | null;
  customerName: string;
  customerMobile: string;
}

export interface ReminderPayload {
  title: string;
  notes?: string;
  dueAt: string; // ISO string
  priority?: ReminderPriority;
  customerId?: string | null;
  customerName?: string;
  customerMobile?: string;
}

export interface ReminderUpdate {
  title?: string;
  notes?: string;
  dueAt?: string;
  priority?: ReminderPriority;
  status?: ReminderStatus;
}

export interface ReminderSummary {
  pending: number;
  overdue: number;
  dueToday: number;
}

export interface Paginated<T> {
  success: boolean;
  data: T[];
  meta: { total: number; pages: number; page: number };
}
