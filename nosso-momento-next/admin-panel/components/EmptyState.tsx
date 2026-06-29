'use client';

type Props = { message?: string };

export default function EmptyState({ message = 'Sem dados ainda.' }: Props) {
  return <p className="text-xs text-white/40 py-6 text-center">{message}</p>;
}
