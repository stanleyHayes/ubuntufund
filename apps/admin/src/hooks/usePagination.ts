import { useState, useMemo, useCallback } from 'react'

export interface PaginationResult<T> {
  /** Items for the current page */
  page: T[]
  /** Current page number (1-based) */
  currentPage: number
  /** Total number of pages */
  totalPages: number
  /** Total number of items (after filtering) */
  totalItems: number
  /** Items per page */
  pageSize: number
  /** Navigate to a specific page */
  goToPage: (page: number) => void
  /** Go to the next page */
  nextPage: () => void
  /** Go to the previous page */
  prevPage: () => void
  /** Change the page size (resets to page 1) */
  setPageSize: (size: number) => void
  /** Whether there is a next page */
  hasNext: boolean
  /** Whether there is a previous page */
  hasPrev: boolean
  /** Index range for display: "1–12 of 50" */
  rangeLabel: string
}

export function usePagination<T>(items: T[], initialPageSize?: number): PaginationResult<T>
export function usePagination<T>(config: { totalItems: number; pageSize: number }): PaginationResult<T>
export function usePagination<T>(
  itemsOrConfig: T[] | { totalItems: number; pageSize: number },
  initialPageSize = 12,
): PaginationResult<T> {
  const isArray = Array.isArray(itemsOrConfig)
  const items: T[] = isArray ? itemsOrConfig : []
  const serverTotalItems = isArray ? undefined : itemsOrConfig.totalItems
  const pageSizeInit = isArray ? initialPageSize : itemsOrConfig.pageSize

  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSizeState] = useState(pageSizeInit)

  const totalItems = serverTotalItems ?? items.length
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize))

  // Clamp current page when items or pageSize change
  const safePage = Math.min(currentPage, totalPages)
  if (safePage !== currentPage) {
    setCurrentPage(safePage)
  }

  const page = useMemo(() => {
    const start = (safePage - 1) * pageSize
    return items.slice(start, start + pageSize)
  }, [items, safePage, pageSize])

  const goToPage = useCallback((p: number) => {
    setCurrentPage(Math.max(1, Math.min(p, totalPages)))
  }, [totalPages])

  const nextPage = useCallback(() => {
    setCurrentPage((p) => Math.min(p + 1, totalPages))
  }, [totalPages])

  const prevPage = useCallback(() => {
    setCurrentPage((p) => Math.max(p - 1, 1))
  }, [])

  const setPageSize = useCallback((size: number) => {
    setPageSizeState(size)
    setCurrentPage(1)
  }, [])

  const start = (safePage - 1) * pageSize + 1
  const end = Math.min(safePage * pageSize, totalItems)
  const rangeLabel = totalItems === 0 ? '0 items' : `${start}–${end} of ${totalItems}`

  return {
    page,
    currentPage: safePage,
    totalPages,
    totalItems,
    pageSize,
    goToPage,
    nextPage,
    prevPage,
    setPageSize,
    hasNext: safePage < totalPages,
    hasPrev: safePage > 1,
    rangeLabel,
  }
}
