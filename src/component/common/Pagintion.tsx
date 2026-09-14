import React from 'react';

interface PagintionProps {
    currentPage: number;
    totalPages: number;
    onPageChange: (page: number) => void;
}

const Pagination = ({ currentPage, totalPages, onPageChange }: PagintionProps) => {

    const handlePageClick = (page: number) => {
        if (page >= 1 && page <= totalPages) {
            onPageChange(page);
        }
    }

    const pageNumber = Array.from({ length: totalPages }, (_, i) => i + 1);

    return (

        <div className="dbt4-pagination-container">
            {pageNumber.map((page) => (
                <span key={page} onClick={(e) => handlePageClick(page)} className={`dbt4-page-num ${currentPage === page ? "dbt4-page-active" : ""}`}>
                    {page}
                </span>
            ))}
        </div>
    )
}

export default Pagination