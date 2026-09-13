import PaginationBar from './PaginationBar'

/** Server queues retain server totals and fetch a fresh page after navigation. */
export default function ReviewQueuePagination({ page, pageSize, total, onPageChange, onPageSizeChange, disabled, rangeLabel }: {
  page: number; pageSize: number; total: number; onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void; disabled?: boolean; rangeLabel?: string;
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const goToPage = (next: number) => onPageChange(Math.max(1, Math.min(next, totalPages)))
  return <PaginationBar neumorphic disabled={disabled} rangeLabel={rangeLabel} pagination={{
    page: [], currentPage: page, totalPages, totalItems: total, pageSize,
    hasPrev: page > 1, hasNext: page < totalPages, goToPage,
    nextPage: () => goToPage(page + 1), prevPage: () => goToPage(page - 1),
    setPageSize: size => { onPageSizeChange(size); onPageChange(1) },
    rangeLabel: total === 0 ? '0 items' : `${Math.min((page - 1) * pageSize + 1, total)}–${Math.min(page * pageSize, total)} of ${total}`,
  }} />
}
