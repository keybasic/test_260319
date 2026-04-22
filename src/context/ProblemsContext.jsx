import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { collection, deleteDoc, doc, onSnapshot, setDoc } from 'firebase/firestore';
import { getProblemById, problemCards, getWorkspaceInputConfig } from '../data/mockData';
import { db } from '../firebase';

function buildDefaultProblems() {
  return problemCards.map((card, index) => {
    const detail = getProblemById(card.id);
    return {
      id: card.id,
      order: index,
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

        const nextProblems = snapshot.docs.map((document) => ({
          ...document.data(),
          id: document.id,
        }));
        const hasMissingOrder = nextProblems.some(
          (problem) => typeof problem.order !== 'number'
        );
        if (hasMissingOrder) {
          const patchedProblems = nextProblems.map((problem, index) => ({
            ...problem,
            order:
              typeof problem.order === 'number' ? problem.order : index,
          }));
          try {
            await Promise.all(
              patchedProblems.map((problem) =>
                setDoc(doc(problemsRef, String(problem.id)), problem)
              )
            );
            return;
          } catch (error) {
            console.error('문제 순서 필드 초기화 중 오류가 발생했습니다.', error);
            setProblems(
              patchedProblems.sort(
                (a, b) => (a.order ?? 0) - (b.order ?? 0)
              )
            );
            setIsLoading(false);
            return;
          }
        }
        setProblems(
          [...nextProblems].sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
        );
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
      const maxOrder = problems.reduce(
        (acc, item) =>
          typeof item.order === 'number' ? Math.max(acc, item.order) : acc,
        -1
      );
      await setDoc(doc(db, 'problems', problemId), {
        ...problem,
        id: problemId,
        order:
          typeof problem.order === 'number' ? problem.order : maxOrder + 1,
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
    const reorderProblems = async (nextOrderedIds) => {
      const orderedIds = nextOrderedIds.map((id) => String(id));
      const currentMap = new Map(
        problems.map((problem) => [String(problem.id), problem])
      );
      const nextProblems = orderedIds
        .map((id) => currentMap.get(id))
        .filter(Boolean)
        .map((problem, index) => ({
          ...problem,
          order: index,
        }));
      await Promise.all(
        nextProblems.map((problem) =>
          setDoc(doc(db, 'problems', String(problem.id)), problem)
        )
      );
    };
    const getProblem = (id) => problems.find((p) => String(p.id) === String(id)) || null;
    return {
      problems,
      isLoading,
      setProblems,
      addProblem,
      updateProblem,
      deleteProblem,
      reorderProblems,
      getProblem,
    };
  }, [isLoading, problems]);

  return <ProblemsContext.Provider value={api}>{children}</ProblemsContext.Provider>;
}

export function useProblems() {
  const ctx = useContext(ProblemsContext);
  if (!ctx) throw new Error('useProblems must be used within ProblemsProvider');
  return ctx;
}

