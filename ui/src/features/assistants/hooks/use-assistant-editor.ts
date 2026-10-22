"use client";

import { useState, useEffect, useRef } from "react";
import { Assistant } from "@/types/entity";

export function useAssistantEditor(
  serverData: Assistant[] | undefined,
  scope = "default",
) {
  const [state, setState] = useState({
    scope,
    editable: [] as Assistant[],
    baseline: [] as Assistant[],
    dirtyIds: new Set<string>(),
    revisions: new Map<string, number>(),
  });
  const savedRevisions = useRef(new WeakMap<Assistant, number>());
  const { editable, dirtyIds } = state;

  // Sync with server data when it loads
  useEffect(() => {
    setState((previous) => {
      if (previous.scope !== scope)
        return {
          scope,
          editable: serverData ?? [],
          baseline: serverData ?? [],
          dirtyIds: new Set(),
          revisions: new Map(),
        };
      if (!serverData) return previous;
      // Merge server-owned fields without replacing locally edited fields.
      const next = serverData.map((incoming) => {
        const draft = previous.editable.find((item) => item.id === incoming.id);
        const baseline = previous.baseline.find(
          (item) => item.id === incoming.id,
        );
        if (!draft || !baseline || !previous.dirtyIds.has(incoming.id))
          return incoming;
        const localChanges = Object.fromEntries(
          Object.entries(draft).filter(
            ([key, value]) =>
              JSON.stringify(value) !==
              JSON.stringify(baseline[key as keyof Assistant]),
          ),
        );
        return { ...incoming, ...localChanges };
      });
      return {
        ...previous,
        editable: next,
        baseline: serverData,
        dirtyIds: new Set(
          [...previous.dirtyIds].filter((id) =>
            serverData.some((item) => item.id === id),
          ),
        ),
      };
    });
  }, [serverData, scope]);

  const updateAssistant = (index: number, updated: Assistant) => {
    setState((previous) => ({
      ...previous,
      editable: previous.editable.map((item) =>
        item.id === updated.id ? updated : item,
      ),
      dirtyIds: new Set(previous.dirtyIds).add(updated.id),
      revisions: new Map(previous.revisions).set(
        updated.id,
        (previous.revisions.get(updated.id) ?? 0) + 1,
      ),
    }));
  };

  const getDirtyAssistants = () => {
    return editable.filter((a) => {
      if (!dirtyIds.has(a.id)) return false;
      savedRevisions.current.set(a, state.revisions.get(a.id) ?? 0);
      return true;
    });
  };

  const markSaved = (saved: Assistant[]) => {
    setState((previous) => {
      const nextDirtyIds = new Set(previous.dirtyIds);
      for (const item of saved) {
        if (
          savedRevisions.current.get(item) === previous.revisions.get(item.id)
        )
          nextDirtyIds.delete(item.id);
      }
      return { ...previous, dirtyIds: nextDirtyIds };
    });
  };

  return {
    editable,
    dirtyIds,
    hasChanges: dirtyIds.size > 0,
    updateAssistant,
    getDirtyAssistants,
    markSaved,
  };
}
