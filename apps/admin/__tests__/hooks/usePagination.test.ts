import { describe, it, expect } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { usePagination } from '@/hooks/usePagination'

const items = Array.from({ length: 50 }, (_, i) => i + 1)

describe('usePagination', () => {
  it('slices the first page with the default page size', () => {
    const { result } = renderHook(() => usePagination(items))
    expect(result.current.page).toEqual(items.slice(0, 12))
    expect(result.current.currentPage).toBe(1)
    expect(result.current.totalPages).toBe(5)
    expect(result.current.rangeLabel).toBe('1–12 of 50')
  })

  it('navigates forward and backward with bounds', () => {
    const { result } = renderHook(() => usePagination(items))
    act(() => result.current.nextPage())
    expect(result.current.currentPage).toBe(2)
    expect(result.current.page[0]).toBe(13)

    act(() => result.current.prevPage())
    act(() => result.current.prevPage())
    expect(result.current.currentPage).toBe(1)

    act(() => result.current.goToPage(999))
    expect(result.current.currentPage).toBe(5)
    expect(result.current.hasNext).toBe(false)
  })

  it('resets to page 1 when the page size changes', () => {
    const { result } = renderHook(() => usePagination(items))
    act(() => result.current.goToPage(3))
    act(() => result.current.setPageSize(25))
    expect(result.current.currentPage).toBe(1)
    expect(result.current.totalPages).toBe(2)
    expect(result.current.page).toHaveLength(25)
  })

  it('supports server-side config with totalItems only', () => {
    const { result } = renderHook(() =>
      usePagination<number>({ totalItems: 120, pageSize: 20 })
    )
    expect(result.current.totalPages).toBe(6)
    expect(result.current.page).toEqual([])
    expect(result.current.rangeLabel).toBe('1–20 of 120')
  })

  it('labels an empty collection as 0 items', () => {
    const { result } = renderHook(() => usePagination<number>([]))
    expect(result.current.rangeLabel).toBe('0 items')
    expect(result.current.totalPages).toBe(1)
  })
})
