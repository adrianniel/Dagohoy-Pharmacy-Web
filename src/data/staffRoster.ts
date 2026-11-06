/*
 * The staff roster: the names an administrator registers, and the names that
 * actually served a shift.
 *
 * Rules (mirrors what the server will enforce later):
 * - Only administrators set the roster. Cashiers can only pick from it.
 * - The roster is a flat list of names, so several staff can be on duty together.
 * - A shift records every selected name; receipts and headings show the first
 *   one, and the full list lives in the shift report.
 *
 * Roster order matters: dropped names go to the bottom so pop-up offers hide
 * them first. Stored in the browser for the design phase.
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

export function addStaff(name: string): RosterStaff {
  const clean = name.trim().replace(/\s+/g, ' ');
  if (clean.length < 2) throw new Error('Enter the staff member’s full name.');
  if (findStaffByName(clean)) throw new Error('That name is already on the roster.');
  const staff: RosterStaff = {
    id: crypto.randomUUID(),
    name: clean,
    status: 'Active',
    createdAt: new Date().toISOString(),
  };
  localStorage.setItem(ROSTER_KEY, JSON.stringify([...loadRoster(), staff]));
  return staff;
}

export function setStaffStatus(id: string, status: RosterStaff['status']) {
  localStorage.setItem(
    ROSTER_KEY,
    JSON.stringify(
      loadRoster().map((staff) => (staff.id === id ? { ...staff, status } : staff)),
    ),
  );
}

export function renameStaff(id: string, name: string) {
  const clean = name.trim().replace(/\s+/g, ' ');
  if (clean.length < 2) throw new Error('Enter the staff member’s full name.');
  const existing = loadRoster().find((staff) => staff.id === id);
  if (!existing) throw new Error('That staff member is no longer on the roster.');
  const clash = findStaffByName(clean);
  if (clash && clash.id !== id) throw new Error('That name is already on the roster.');
  localStorage.setItem(
    ROSTER_KEY,
    JSON.stringify(loadRoster().map((staff) => (staff.id === id ? { ...staff, name: clean } : staff))),
  );
}

export function removeStaff(id: string) {
  localStorage.setItem(
    ROSTER_KEY,
    JSON.stringify(loadRoster().filter((staff) => staff.id !== id)),
  );
}

/** Opens the shift with the whole on-duty list, naming the first pick as the head. */
export function onDutyLabel(onDutyNames: string[]): string {
  const first = onDutyNames[0]?.trim();
  if (!first) return 'Cashier';
  return onDutyNames.length > 1 ? `${first} +${onDutyNames.length - 1}` : first;
}
