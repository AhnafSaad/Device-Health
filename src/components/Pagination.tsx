import React from 'react';
import { ChevronLeft, ChevronRight, Server } from 'lucide-react';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  pageSize: number;
  onPageSizeChange: (size: number) => void;
  totalItems: number;
  virtualTotalEstimate?: number;
}

export const Pagination: React.FC<PaginationProps> = ({
  currentPage,
  totalPages,
  onPageChange,
  pageSize,
  onPageSizeChange,
  totalItems,
  virtualTotalEstimate = 10482,
}) => {
  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    const maxVisible = 5;

    if (totalPages <= maxVisible) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      pages.push(1);
      if (currentPage > 3) {
        pages.push('...');
      }

      const start = Math.max(2, currentPage - 1);
      const end = Math.min(totalPages - 1, currentPage + 1);

      for (let i = start; i <= end; i++) {
        if (!pages.includes(i)) {
          pages.push(i);
        }
      }

      if (currentPage < totalPages - 2) {
        pages.push('...');
      }

      if (!pages.includes(totalPages)) {
        pages.push(totalPages);
      }
    }

    return pages;
  };

  const startItem = totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const endItem = Math.min(currentPage * pageSize, totalItems);

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 sm:px-6 bg-base-100/90 border-t border-base-content/10 text-xs text-base-content/70 backdrop-blur-md">
      {/* Records info */}
      <div className="flex items-center gap-2.5">
        <span className="font-mono">
          Showing <span className="font-bold text-base-content">{startItem}</span>–
          <span className="font-bold text-base-content">{endItem}</span> of{' '}
          <span className="font-bold text-primary">{totalItems}</span> matching nodes
        </span>
        <span className="px-2 py-0.5 rounded-full bg-base-200 border border-base-content/10 text-[10px] font-mono text-base-content/60 hidden md:inline-flex">
          Cluster Total: {virtualTotalEstimate.toLocaleString()}
        </span>
      </div>

      {/* Controls & Pagination Buttons */}
      <div className="flex items-center gap-3">
        {/* Page size selector */}
        <div className="flex items-center gap-1.5 font-mono text-[11px]">
          <span className="text-base-content/50">Rows:</span>
          <select
            value={pageSize}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
            className="px-2.5 py-1 rounded-lg border border-base-content/15 bg-base-200/60 text-xs font-semibold focus:border-primary focus:outline-none"
            aria-label="Rows per page"
          >
            <option value={5}>5 / page</option>
            <option value={10}>10 / page</option>
            <option value={25}>25 / page</option>
            <option value={50}>50 / page</option>
            <option value={100}>100 / page</option>
          </select>
        </div>

        {/* Modern Pill Pagination */}
        <div className="flex items-center gap-1 bg-base-200/50 p-1 rounded-xl border border-base-content/10">
          {/* Prev Button */}
          <button
            onClick={() => onPageChange(currentPage - 1)}
            disabled={currentPage <= 1}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold text-base-content/70 hover:text-base-content hover:bg-base-100 disabled:opacity-30 disabled:hover:bg-transparent transition-all"
            aria-label="Previous page"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
            <span className="hidden xs:inline">Prev</span>
          </button>

          {/* Page Numbers */}
          {getPageNumbers().map((page, idx) => {
            if (page === '...') {
              return (
                <span
                  key={`ellipsis-${idx}`}
                  className="px-2 text-base-content/40 font-mono select-none"
                >
                  ...
                </span>
              );
            }

            const pageNum = Number(page);
            const isActive = pageNum === currentPage;

            return (
              <button
                key={pageNum}
                onClick={() => onPageChange(pageNum)}
                className={`w-7 h-7 flex items-center justify-center rounded-lg text-xs font-mono font-bold transition-all ${
                  isActive
                    ? 'bg-primary text-primary-content shadow-sm shadow-primary/30'
                    : 'text-base-content/70 hover:text-base-content hover:bg-base-100'
                }`}
                aria-current={isActive ? 'page' : undefined}
                aria-label={`Go to page ${pageNum}`}
              >
                {pageNum}
              </button>
            );
          })}

          {/* Next Button */}
          <button
            onClick={() => onPageChange(currentPage + 1)}
            disabled={currentPage >= totalPages || totalPages === 0}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold text-base-content/70 hover:text-base-content hover:bg-base-100 disabled:opacity-30 disabled:hover:bg-transparent transition-all"
            aria-label="Next page"
          >
            <span className="hidden xs:inline">Next</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
