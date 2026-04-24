import React from 'react';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import { Button } from '../ui/button';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

const Pagination: React.FC<PaginationProps> = ({ 
  currentPage, 
  totalPages, 
  onPageChange 
}) => {
  // Return null if there's only one page
  if (totalPages <= 1) {
    return null;
  }
  
  // Calculate page numbers to show
  const getPageNumbers = () => {
    const delta = 1; // Number of pages to show on each side of current page
    const pages = [];
    
    // Always show first page
    pages.push(1);
    
    // Calculate range of pages to show around current page
    const rangeStart = Math.max(2, currentPage - delta);
    const rangeEnd = Math.min(totalPages - 1, currentPage + delta);
    
    // Add ellipsis if there's a gap after page 1
    if (rangeStart > 2) {
      pages.push(-1); // -1 represents ellipsis
    }
    
    // Add range pages
    for (let i = rangeStart; i <= rangeEnd; i++) {
      pages.push(i);
    }
    
    // Add ellipsis if there's a gap before last page
    if (rangeEnd < totalPages - 1) {
      pages.push(-2); // -2 represents ellipsis (different key from the first one)
    }
    
    // Always show last page if not already included
    if (totalPages > 1) {
      pages.push(totalPages);
    }
    
    return pages;
  };
  
  const pageNumbers = getPageNumbers();
  
  return (
    <div className="flex items-center justify-center space-x-2 my-4">
      {/* First page button */}
      <Button
        variant="outline"
        size="icon"
        onClick={() => onPageChange(1)}
        disabled={currentPage === 1}
        className="h-8 w-8"
        aria-label="First page"
      >
        <ChevronsLeft className="h-4 w-4" />
      </Button>
      
      {/* Previous page button */}
      <Button
        variant="outline"
        size="icon"
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage === 1}
        className="h-8 w-8"
        aria-label="Previous page"
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>
      
      {/* Page numbers */}
      {pageNumbers.map((page, index) => {
        if (page < 0) {
          // Render ellipsis
          return (
            <span key={`ellipsis-${page}`} className="px-2">
              ...
            </span>
          );
        }
        
        return (
          <Button
            key={`page-${page}`}
            variant={currentPage === page ? "default" : "outline"}
            size="sm"
            onClick={() => onPageChange(page)}
            className="h-8 w-8 px-0"
            aria-label={`Page ${page}`}
            aria-current={currentPage === page ? "page" : undefined}
          >
            {page}
          </Button>
        );
      })}
      
      {/* Next page button */}
      <Button
        variant="outline"
        size="icon"
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage === totalPages}
        className="h-8 w-8"
        aria-label="Next page"
      >
        <ChevronRight className="h-4 w-4" />
      </Button>
      
      {/* Last page button */}
      <Button
        variant="outline"
        size="icon"
        onClick={() => onPageChange(totalPages)}
        disabled={currentPage === totalPages}
        className="h-8 w-8"
        aria-label="Last page"
      >
        <ChevronsRight className="h-4 w-4" />
      </Button>
    </div>
  );
};

export default Pagination; 