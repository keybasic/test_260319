import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { getProblemById, problemCards, getWorkspaceInputConfig } from '../data/mockData';

const STORAGE_KEY = 'geo-guide-problems-v1';

function buildDefaultProblems() {
  return problemCards.map((card) => {
    const detail = getProblemById(card.id);
    return {
      id: card.id,
      title: card.title,
      emoji: card.emoji,
      description: card.description,
      difficulty: card.difficulty,
      topic: card.topic,
      proposition: detail.proposition,
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
  const [problems, setProblems] = useState(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return buildDefaultProblems();
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) && parsed.length ? parsed : buildDefaultProblems();
    } catch {
      return buildDefaultProblems();
    }
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(problems));
  }, [problems]);

  const api = useMemo(() => {
    const addProblem = (problem) => setProblems((prev) => [problem, ...prev]);
    const updateProblem = (id, patch) =>
      setProblems((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)));
    const deleteProblem = (id) =>
      setProblems((prev) => prev.filter((p) => p.id !== id));
    const getProblem = (id) => problems.find((p) => String(p.id) === String(id)) || null;
    return { problems, setProblems, addProblem, updateProblem, deleteProblem, getProblem };
  }, [problems]);

  return <ProblemsContext.Provider value={api}>{children}</ProblemsContext.Provider>;
}

export function useProblems() {
  const ctx = useContext(ProblemsContext);
  if (!ctx) throw new Error('useProblems must be used within ProblemsProvider');
  return ctx;
}

