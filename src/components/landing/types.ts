export interface WeeklyHoursEntry {
  day: number;
  label: string;
  opensAt: string | null;
  closesAt: string | null;
}

export interface StaffMember {
  initials: string;
  role: string;
  displayName: string;
}
