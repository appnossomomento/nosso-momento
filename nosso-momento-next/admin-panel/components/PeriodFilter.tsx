'use client';

import { PERIOD_OPTIONS, ADMIN_SELECT_CLASS } from '@/admin-panel/constants';

type Props = {
  value: number;
  onChange: (days: number) => void;
};

export default function PeriodFilter({ value, onChange }: Props) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      className={ADMIN_SELECT_CLASS}
      aria-label="Período"
    >
      {PERIOD_OPTIONS.map((o) => (
        <option key={o.days} value={o.days} className="bg-[#2a2a2a] text-white">
          {o.label}
        </option>
      ))}
    </select>
  );
}
