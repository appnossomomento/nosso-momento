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
 * Abre o popup:
 * - uma vez por sessão do app (nova sessão)
 * - ou quando o usuário clica no push (`openSurveyFromNotification`)
 */
export function usePendingSurvey() {
  const usuario = useAppStore((s) => s.usuario);
  const authInitialized = useAppStore((s) => s.authInitialized);
  const openSurveyFromNotification = useAppStore((s) => s.openSurveyFromNotification);
  const pendingSurvey = useAppStore((s) => s.pendingSurvey);
  const set = useAppStore((s) => s.set);
  const sessionGateDoneRef = useRef(false);

  // Clique no push (ou deep link) com pesquisa já carregada.
  useEffect(() => {
    if (!openSurveyFromNotification || !pendingSurvey) return;
    set({ showSurveyPopup: true, openSurveyFromNotification: false });
  }, [openSurveyFromNotification, pendingSurvey, set]);

  useEffect(() => {
    if (!authInitialized || !usuario?.uid || !db || isAdminPath()) {
      if (!usuario?.uid) {
        sessionGateDoneRef.current = false;
        set({
          pendingSurvey: null,
          showSurveyPopup: false,
          openSurveyFromNotification: false,
        });
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

        const openFromPush = useAppStore.getState().openSurveyFromNotification;

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

        const shouldOpen =
          !sessionGateDoneRef.current || openFromPush;

        if (!sessionGateDoneRef.current) {
          sessionGateDoneRef.current = true;
        }

        if (shouldOpen) {
          set({
            pendingSurvey: survey,
            showSurveyPopup: true,
            openSurveyFromNotification: false,
          });
        } else {
          set({ pendingSurvey: survey });
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
