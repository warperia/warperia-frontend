import React from 'react';

const ToastNotifications = ({ toasts, onRemoveToast }) => {
  return (
    <div
      className="toast-container position-fixed bottom-0 end-0 p-3"
      style={{ zIndex: 11 }}
    >
      {toasts.map(toast => (
        <div
          key={toast.id}
          className={`toast show`}
          role="alert"
          aria-live="assertive"
          aria-atomic="true"
        >
          <div className={`toast-header text-${toast.type}`}>
            <strong className="me-auto"><i className="bi bi-bell"></i> Notification</strong>
            <button
              type="button"
              className="btn-close btn-close-white"
              data-bs-dismiss="toast"
              aria-label="Close"
              onClick={() => onRemoveToast(toast.id)}
            ></button>
          </div>
          <div className="toast-body">{toast.message}</div>
        </div>
      ))}
    </div>
  );
};

export default ToastNotifications;