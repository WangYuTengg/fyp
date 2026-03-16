import { useState } from 'react';

type SetPageInput = number | ((currentPage: number) => number);

function clampPage(page: number, totalPages: number): number {
  return Math.min(Math.max(page, 1), Math.max(totalPages, 1));
}

export function useClampedPage(totalPages: number, initialPage = 1) {
  const [pageState, setPageState] = useState(() => clampPage(initialPage, totalPages));
  const page = clampPage(pageState, totalPages);

  const setPage = (nextPage: SetPageInput) => {
    setPageState((currentPage) => {
      const resolvedPage =
        typeof nextPage === 'function' ? nextPage(clampPage(currentPage, totalPages)) : nextPage;

      return clampPage(resolvedPage, totalPages);
    });
  };

  return {
    page,
    setPage,
    resetPage: () => setPageState(1),
  };
}
