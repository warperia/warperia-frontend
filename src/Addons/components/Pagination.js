import React from 'react';

const Pagination = ({ currentPage, totalPages, onPageChange, onJumpToPage }) => {
  // Ensure totalPages is a valid number and at least 1
  const safeTotalPages = Number.isNaN(totalPages) || totalPages < 1 ? 1 : totalPages;

  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= safeTotalPages) {
      onPageChange(newPage);
      setTimeout(() => {
        const rootElement = document.getElementById('root');
        const targetElement = document.getElementById('browse-addons');
  
        if (targetElement && rootElement) {
          const scrollTop = targetElement.offsetTop;
          rootElement.scrollTo({
            top: scrollTop,
            behavior: 'smooth'
          });
        }
      }, 0);
    }
  };

  const handleJumpToPage = (event) => {
    const inputValue = event.target.value;
    const pageNumber = parseInt(inputValue, 10);
  
    if (!isNaN(pageNumber) && pageNumber >= 1 && pageNumber <= safeTotalPages) {
      onPageChange(pageNumber);
      setTimeout(() => {
        const rootElement = document.getElementById('root');
        const targetElement = document.getElementById('browse-addons');
  
        if (targetElement && rootElement) {
          const scrollTop = targetElement.offsetTop;
          rootElement.scrollTo({
            top: scrollTop,
            behavior: 'smooth'
          });
        }
      }, 100);
    }
  };

  const startPage = Math.max(currentPage - 2, 1);
  const endPage = Math.min(startPage + 5, safeTotalPages);
  const totalPagesToShow = endPage - startPage + 1;
  const middleIndex = Math.floor(totalPagesToShow / 2);

  const pages = [];
  for (let i = startPage; i <= endPage; i++) {
    pages.push(
      <li key={i} className={`page-item ${i === currentPage ? 'active' : ''}`}>
        <button className="page-link" onClick={() => handlePageChange(i)}>
          {i}
        </button>
      </li>
    );
  }

  return (
    <nav aria-label="Addon pagination" className="mt-5">
      <ul className="pagination justify-content-center gap-1">
        <li className={`page-item ${currentPage === 1 ? 'disabled' : ''}`}>
          <button className="page-link" onClick={() => handlePageChange(currentPage - 1)}>
            <i className="bi bi-arrow-left"></i>
          </button>
        </li>
        {pages.slice(0, middleIndex)}
        <li className="page-item jump-page">
          <input
            type="number"
            className="form-control text-center"
            placeholder="#"
            style={{ width: '60px', display: 'inline-block' }}
            min="1"
            max={safeTotalPages}
            onBlur={handleJumpToPage}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                handleJumpToPage(event);
              }
            }}
          />
        </li>
        {pages.slice(middleIndex)}
        <li className={`page-item ${currentPage === safeTotalPages ? 'disabled' : ''}`}>
          <button className="page-link" onClick={() => handlePageChange(currentPage + 1)}>
            <i className="bi bi-arrow-right"></i>
          </button>
        </li>
      </ul>
    </nav>
  );
};

export default Pagination;