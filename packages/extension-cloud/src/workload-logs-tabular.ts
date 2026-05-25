import type { TabularData } from '@eclipse-docks/extension-dataviewer/api';

/** Converts container/pod log text into tabular data for `docks-data-table`. */
export function logsTextToTabular(text: string): TabularData {
  const columns = ['#', 'message'];
  if (!text) return { columns, rows: [] };
  const rows = text.split(/\r?\n/).map((message, index) => [index + 1, message]);
  return { columns, rows };
}
