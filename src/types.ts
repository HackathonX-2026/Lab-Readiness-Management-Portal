export type TestStatus = 'Passed' | 'Failed' | 'In Progress' | 'Not Started';

export type ReadinessStatus =
  | 'Ready'
  | 'Retest Required'
  | 'Testing Pending'
  | 'Action Required';

export type Role = 'Admin' | 'Tester' | 'Manager';

export interface AppUser {
  id: string;
  displayName: string;
  email: string;
  role: Role;
  passwordHash: string;
  createdAt: string;
  createdBy: string;
  disabled?: boolean;
}

export interface AuditEntry {
  id: string;
  at: string;
  actor: string;
  action: string;
  target?: string;
  details?: string;
}

export type Priority = 'P0' | 'P1' | 'P2' | 'P3' | 'P4' | null;

export interface Lab {
  id: string;
  trackName: string;
  labName: string;
  language: string;
  upcomingWorkshopDate: string | null;
  workshopsScheduledDates?: string | null;
  assignedDate?: string | null;
  assignedTo: string | null;
  testDate: string | null;
  testStatus: TestStatus;
  priority?: Priority;
  reviewer?: string | null;
  requestor?: string | null;
  updatedInTrackSheet?: string | null;
  pendingItemReviewStatus?: string | null;
  costEstimationLink?: string | null;
  remarks?: string | null;
  releaseNoteStatus?: string | null;
  releaseNoteLink?: string | null;
  pptLink?: string | null;
  pptStatus?: string | null;
  comments: string;
  lastUpdatedBy: string;
  lastUpdatedDate: string;
}

export interface Notification {
  id: string;
  type: 'workshop-soon' | 'retest' | 'failed' | 'workshop-urgent';
  labId: string;
  message: string;
  channel: ('Email' | 'Teams')[];
  createdAt: string;
  read: boolean;
}
