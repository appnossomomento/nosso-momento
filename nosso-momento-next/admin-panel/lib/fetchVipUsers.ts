import type { Firestore } from 'firebase-admin/firestore';
import type { AdminVipUser } from '../types';

function toDate(raw: unknown): Date | null {
  if (!raw) return null;
  if (raw instanceof Date) return raw;
  if (typeof raw === 'object' && raw !== null && 'toDate' in raw) {
    return (raw as { toDate: () => Date }).toDate();
  }
  if (typeof raw === 'string' || typeof raw === 'number') {
    const d = new Date(raw);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return null;
}

export async function fetchVipUsers(db: Firestore): Promise<AdminVipUser[]> {
  const snap = await db.collection('usuarios').get();
  const rows: AdminVipUser[] = snap.docs.map((doc) => {
    const d = doc.data();
    const created = toDate(d.createdAt);
    const vipUpdated = toDate(d.vipUpdatedAt);
    return {
      uid: doc.id,
      email: String(d.email ?? ''),
      nome: String(d.nome ?? ''),
      telefone: String(d.telefone ?? '').trim(),
      vip: d.vip === true,
      vipUpdatedAt: vipUpdated ? vipUpdated.toISOString() : null,
      vipUpdatedBy: d.vipUpdatedBy ? String(d.vipUpdatedBy) : null,
      createdAt: created ? created.toISOString() : '',
    };
  });

  rows.sort((a, b) => {
    if (a.vip !== b.vip) return a.vip ? -1 : 1;
    return a.email.localeCompare(b.email, 'pt-BR');
  });

  return rows;
}
