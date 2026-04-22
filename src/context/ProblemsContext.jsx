import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { collection, deleteDoc, doc, onSnapshot, setDoc } from 'firebase/firestore';
import { getProblemById, problemCards, getWorkspaceInputConfig } from '../data/mockData';
import { db } from '../firebase';

function buildDefaultProblems() {
  return problemCards.map((card, idx) => {
    const detail = getProblemById(card.id);
    return {
      id: card.id,
      displayOrder: idx + 1,
      title: card.title,
      emoji: card.emoji,
      description: card.description,
      difficulty: card.difficulty,
      topic: card.topic,
      proposition: detail.proposition,
      teachingGuide: '',
      imageAlt: detail.imageAlt,
      imageFileName: '',
      imageDataUrl: '',
      allowedMethods: getWorkspaceInputConfig(card.id),
      rubric: {
        positiveKeywords: [],
        misconceptionKeywords: [],
        counterexampleImageFileName: '',
        counterexampleImageDataUrl: '',
        hintQuestion: '',
      },
      steps: [],
    };
  });
}

const ProblemsContext = createContext(null);

export function ProblemsProvider({ children }) {
  const [problems, setProblems] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const problemsRef = collection(db, 'problems');

    const unsubscribe = onSnapshot(
      problemsRef,
      async (snapshot) => {
        if (!active) return;

        if (snapshot.empty) {
          const defaults = buildDefaultProblems();
          try {
            await Promise.all(
              defaults.map((problem) =>
                setDoc(doc(problemsRef, String(problem.id)), {
                  ...problem,
                  id: String(problem.id),
                })
              )
            );
          } catch (error) {
            console.error('기본 문제 초기화 중 오류가 발생했습니다.', error);
            if (active) {
              setProblems(defaults);
              setIsLoading(false);
            }
          }
          return;
        }

        const nextProblems = snapshot.docs
          .map((document, idx) => {
            const data = document.data();
            const parsedOrder = Number(data.displayOrder);
            return {
              ...data,
              id: document.id,
              displayOrder: Number.isFinite(parsedOrder) ? parsedOrder : idx + 1,
            };
          })
          .sort((a, b) => a.displayOrder - b.displayOrder);
        setProblems(nextProblems);
        setIsLoading(false);
      },
      (error) => {
        console.error('문제 목록을 불러오는 중 오류가 발생했습니다.', error);
        if (active) {
          setProblems(buildDefaultProblems());
          setIsLoading(false);
        }
      }
    );

    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  const api = useMemo(() => {
    const addProblem = async (problem) => {
      const problemId = String(problem.id ?? `prob-${Date.now()}`);
      const maxOrder = problems.reduce((max, item) => {
        const current = Number(item.displayOrder);
        if (!Number.isFinite(current)) return max;
        return Math.max(max, current);
      }, 0);
      const requestedOrder = Number(problem.displayOrder);
      const displayOrder = Number.isFinite(requestedOrder)
        ? requestedOrder
        : maxOrder + 1;
      await setDoc(doc(db, 'problems', problemId), {
        ...problem,
        id: problemId,
        displayOrder,
      });
      return problemId;
    };
    const updateProblem = async (id, patch) => {
      const problemId = String(id);
      const current = problems.find((p) => String(p.id) === problemId);
      if (!current) throw new Error('수정할 문제를 찾지 못했습니다.');
      await setDoc(doc(db, 'problems', problemId), {
        ...current,
        ...patch,
        id: problemId,
      });
    };
    const deleteProblem = async (id) => deleteDoc(doc(db, 'problems', String(id)));
    const getProblem = (id) => problems.find((p) => String(p.id) === String(id)) || null;
    const reorderProblems = async (orderedIds) => {
      const normalizedIds = orderedIds.map((id) => String(id));
      await Promise.all(
        normalizedIds.map((id, idx) => {
          const current = problems.find((p) => String(p.id) === id);
          if (!current) return Promise.resolve();
          return setDoc(doc(db, 'problems', id), {
            ...current,
            id,
            displayOrder: idx + 1,
          });
        })
      );
    };
    return {
      problems,
      isLoading,
      setProblems,
      addProblem,
      updateProblem,
      deleteProblem,
      getProblem,
      reorderProblems,
    };
  }, [isLoading, problems]);

  return <ProblemsContext.Provider value={api}>{children}</ProblemsContext.Provider>;
}

export function useProblems() {
  const ctx = useContext(ProblemsContext);
  if (!ctx) throw new Error('useProblems must be used within ProblemsProvider');
  return ctx;
}

