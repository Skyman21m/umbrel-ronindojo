import { useCallback, useState } from "react";

export const usePagination = <T>(data: T[], pageSize: number) => {
  const [currentPage, setCurrentPage] = useState(0);
  const pageCount = Math.ceil(data.length / pageSize) || 1;

  const setFirstPage = useCallback(() => {
    setCurrentPage(0);
  }, []);
  const setPrevPage = useCallback(() => {
    setCurrentPage((state) => Math.max(state - 1, 0));
  }, []);
  const setNextPage = useCallback(() => {
    setCurrentPage((state) => Math.min(state + 1, pageCount - 1));
  }, [pageCount]);
  const setLastPage = useCallback(() => {
    setCurrentPage(pageCount - 1);
  }, [pageCount]);

  const paginatedData: T[] = data.slice(currentPage * pageSize, currentPage * pageSize + pageSize);

  return {
    paginatedData,
    setFirstPage,
    setPrevPage,
    setNextPage,
    setLastPage,
    setPage: setCurrentPage,
    currentPage,
    pageCount,
  };
};
