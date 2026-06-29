'use client';

type Column<T> = {
  key: keyof T | string;
  header: string;
  render?: (row: T) => React.ReactNode;
};

type Props<T extends Record<string, unknown>> = {
  columns: Column<T>[];
  rows: T[];
  emptyMessage?: string;
};

export default function DataTable<T extends Record<string, unknown>>({
  columns,
  rows,
  emptyMessage = 'Sem dados ainda.',
}: Props<T>) {
  if (!rows.length) {
    return <p className="text-xs text-white/40 py-4 text-center">{emptyMessage}</p>;
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-white/10">
      <table className="w-full text-xs">
        <thead>
          <tr className="bg-white/5 text-white/60 text-left">
            {columns.map((col) => (
              <th key={String(col.key)} className="px-3 py-2 font-medium whitespace-nowrap">
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className={i % 2 === 0 ? 'bg-white/[0.02]' : 'bg-transparent'}>
              {columns.map((col) => (
                <td key={String(col.key)} className="px-3 py-2 text-white/75 whitespace-nowrap">
                  {col.render
                    ? col.render(row)
                    : String(row[col.key as keyof T] ?? '—')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
