/** A batch number as printed on the box: letters, numbers and "-" only, kept in capitals. */
export const cleanBatch = (value: string) =>
  value
    .toUpperCase()
    .replace(/[^A-Z0-9-]/g, '')
    .slice(0, 60);
