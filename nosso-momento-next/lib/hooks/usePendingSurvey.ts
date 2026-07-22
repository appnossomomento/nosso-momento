'use client';

import { useEffect, useRef } from 'react';
import {
  collection,
  query,
  where,
  limit,
  onSnapshot,
  doc,
  getDoc,
} from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import { useAppStore } from '@/lib/store/appStore';
import { userMatchesSurveySegment } from '@/lib/surveys/segments';
import type { Survey, SurveyQuestion, SurveySegment } from '@/lib/types/survey';

const ADMIN_PREFIX = '/paineladmin-monitoring-v0';

function isAdminPath(): boolean {
  if (typeof window === 'undefined') return false;
  return window.location.pathname.startsWith(ADMIN_PREFIX);
}

/**
 * Mantém `pendingSurvey` atualizado.
 * Abre o popup só uma vez por sessão do app (cold start / remount do AuthProvider).
 * Disparo mid-session → só push no SO; próxima abertura do app mostra o popup.
 */
export function usePendingSurvey() {
  const usuario = useAppStore((s) => s.usuario);
  const authInitialized = useAppStore((s) => s.authInitialized);
  const set = useAppStore((s) => s.set);
  const sessionGateDoneRef = useRef(false);

  useEffect(() => {
    if (!authInitialized || !usuario?.uid || !db || isAdminPath()) {
      if (!usuario?.uid) {
        sessionGateDoneRef.current = false;
        set({ pendingSurvey: null, showSurveyPopup: false });
      }
      return;
    }

    const uid = usuario.uid;
    const q = query(
      collection(db, 'surveys'),
      where('status', '==', 'active'),
      limit(1),
    );

    const unsub = onSnapshot(
      q,
      async (snap) => {
        if (isAdminPath()) {
          set({ pendingSurvey: null, showSurveyPopup: false });
          return;
        }

        if (snap.empty) {
          set({ pendingSurvey: null, showSurveyPopup: false });
          if (!sessionGateDoneRef.current) sessionGateDoneRef.current = true;
          return;
        }
        const d = snap.docs[0];
        const data = d.data() || {};
        const survey: Survey = {
          id: d.id,
          title: String(data.title || ''),
          questions: Array.isArray(data.questions)
            ? (data.questions as SurveyQuestion[])
            : [],
          segment: (data.segment as SurveySegment) || 'todos',
          status: 'active',
          pushTitle: String(data.pushTitle || ''),
          pushBody: String(data.pushBody || ''),
          createdBy: String(data.createdBy || ''),
          createdAt: null,
          dispatchedAt: null,
          closedAt: null,
        };

        if (
          !userMatchesSurveySegment(
            {
              vip: usuario.vip === true,
              anatomia: usuario.anatomia,
              sexo: usuario.sexo,
            },
            survey.segment,
          )
        ) {
          set({ pendingSurvey: null, showSurveyPopup: false });
          if (!sessionGateDoneRef.current) sessionGateDoneRef.current = true;
          return;
        }

        try {
          const respRef = doc(db, 'surveyResponses', `${survey.id}_${uid}`);
          const respSnap = await getDoc(respRef);
          if (respSnap.exists()) {
            set({ pendingSurvey: null, showSurveyPopup: false });
            if (!sessionGateDoneRef.current) sessionGateDoneRef.current = true;
            return;
          }
        } catch {
          set({ pendingSurvey: null, showSurveyPopup: false });
          if (!sessionGateDoneRef.current) sessionGateDoneRef.current = true;
          return;
        }

        set({ pendingSurvey: survey });

        // Só abre popup no gate da sessão (primeira avaliação após abrir o app).
        if (!sessionGateDoneRef.current) {
          sessionGateDoneRef.current = true;
          set({ showSurveyPopup: true });
        }
      },
      () => {
        set({ pendingSurvey: null, showSurveyPopup: false });
        if (!sessionGateDoneRef.current) sessionGateDoneRef.current = true;
      },
    );

    return () => unsub();
  }, [
    authInitialized,
    usuario?.uid,
    usuario?.vip,
    usuario?.anatomia,
    usuario?.sexo,
    set,
  ]);
}
