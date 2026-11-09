/*
 * The staff roster: the names an administrator registers, and the names that
 * actually served a shift.
 *
 * Rules (enforced by the server, which keeps the roster; this is the browser copy
 * that serverSync refreshes):
 * - Only administrators set the roster. Cashiers can only pick from it.
 * - The roster is a flat list of names, so several staff can be on duty together.
 * - A shift records every selected name; receipts and headings show the first
 *   one, and the full list lives in the shift report.
 *
 * Roster order matters: dropped names go to the bottom so pop-up offers hide
 * them first.
 */

const ROSTER_KEY = 'dagohoy_demo_staff_roster';

export type RosterStaff = {
  id: string;
  name: string;
  status: 'Active' | 'Inactive';
  createdAt: string;
};

function readJson<T>(key: string, fallback: T): T {
  try {
    return (JSON.parse(localStorage.getItem(key) ?? 'null') as T) ?? fallback;
  } catch {
    return fallback;
  }
}

export function loadRoster(): RosterStaff[] {
  return readJson<RosterStaff[]>(ROSTER_KEY, []);
}

/** Staff a cashier may pick when opening the register. */
export function getActiveRoster(): RosterStaff[] {
  return loadRoster().filter((staff) => staff.status === 'Active');
}

export function findStaffByName(name: string): RosterStaff | undefined {
  const normalized = name.trim().toLowerCase();
  return loadRoster().find((staff) => staff.name.toLowerCase() === normalized);
}

/** Opens the shift with the whole on-duty list, naming the first pick as the head. */
export function onDutyLabel(onDutyNames: string[]): string {
  const first = onDutyNames[0]?.trim();
  if (!first) return 'Cashier';
  return onDutyNames.length > 1 ? `${first} +${onDutyNames.length - 1}` : first;
}
