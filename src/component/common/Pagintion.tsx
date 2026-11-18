import React from 'react';

interface PagintionProps {
    currentPage: number;
    totalPages: number;
    onPageChange: (page: number) => void;
    totalRecords?: number;
    hasData?: boolean;
}

const Pagination = ({
    currentPage,
    totalPages,
    onPageChange,
    totalRecords,
    hasData,
}: PagintionProps) => {
    // If no data found, or totalRecords is 0, or totalPages <= 0, don't show pagination
    if (hasData === false) return null;
    if (totalRecords !== undefined && totalRecords <= 0) return null;
    if (!totalPages || totalPages <= 0) return null;

    const handlePageClick = (page: number) => {
        if (page >= 1 && page <= totalPages) {
            onPageChange(page);
        }
    };

    const pageNumber = Array.from({ length: totalPages }, (_, i) => i + 1);

    return (
        <div className="dbt4-pagination-container">
            {pageNumber.map((page) => (
                <span
                    key={page}
                    onClick={() => handlePageClick(page)}
                    className={`dbt4-page-num ${currentPage === page ? "dbt4-page-active" : ""}`}
                >
                    {page}
                </span>
            ))}
        </div>
    );
};

export default Pagination