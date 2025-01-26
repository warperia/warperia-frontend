import React, { useState, useEffect } from 'react';
import 'bootstrap/dist/css/bootstrap.min.css';
import "bootstrap-icons/font/bootstrap-icons.css";

function DeleteConfirmationModal({
  show,
  onClose,
  onConfirmDelete,
  addonToDelete,
  newAddon,
  parentWarnings = [],
  nestedAddons = [],
  isInstallation = false
}) {

  // Build local state to track which nested addons the user also wants to delete
  const [selectedDeletions, setSelectedDeletions] = useState(() => {
    const initial = {};
    nestedAddons.forEach((child) => {
      initial[child.id] = true; // default: selected for deletion
    });
    return initial;
  });

  useEffect(() => {
    if (show) {
        const initial = {};
        nestedAddons.forEach((child) => {
            initial[child.id] = true;
        });
        setSelectedDeletions(initial);
    }
}, [show, nestedAddons]);

  // Toggle a sub-addon's selection
  const handleToggle = (addonId) => {
    setSelectedDeletions((prev) => ({
      ...prev,
      [addonId]: !prev[addonId],
    }));
  };

  // Handler when user deletes
  const handleConfirm = () => {
    // Build a list of IDs the user wants to delete
    const selectedIds = Object.entries(selectedDeletions)
      .filter(([_, shouldDelete]) => shouldDelete)
      .map(([id]) => parseInt(id, 10));

    onConfirmDelete(selectedIds);
  };

  // If the modal is not shown, render nothing
  if (!show || !addonToDelete) {
    return null;
  }

  return (
    <>
      <div className="modal-backdrop fade show"></div>
      <div className="modal fade show d-block" tabIndex="-1" role="dialog">
        <div className="modal-dialog modal-dialog-centered modal-lg modal-dialog-scrollable modal-dark modal-fixed-height modal-delete">
          <div className="modal-content">
            <div className="modal-header">
              <h5 className="modal-title">
                {isInstallation && newAddon
                  ? `Confirm Installation`
                  : `Confirm Deletion`}
              </h5>
              <button
                type="button"
                className="btn-close btn-close-white"
                aria-label="Close"
                onClick={onClose}
              ></button>
            </div>
            <div className="modal-body">
              {isInstallation && newAddon ? (
                <p>
                  <i className="bi bi-exclamation-circle-fill text-warning me-2"></i>
                  You're switching from {addonToDelete?.title} <i className="bi bi-arrow-right text-success fs-5"></i> {newAddon?.title} 
                </p>
              ) : (
                <p>
                  <i className="bi bi-exclamation-circle-fill text-danger me-1"></i> You are about to delete <strong>{addonToDelete?.title}</strong>
                </p>
              )}

              {parentWarnings.length > 0 && (
                <div className="alert alert-medium">
                  <p className="mb-1 fw-medium text-warning"><i className="bi bi-exclamation-circle-fill me-1"></i> Warning!</p>
                  <small>
                    This addon is bundled into the following addon(s):
                    {parentWarnings.map((p, idx) => (
                      <span key={p.id}> {p.title}{idx < parentWarnings.length - 1 ? ',' : ''}</span>
                    ))}
                    . Deleting it might break them!
                  </small>
                </div>
              )}

              {nestedAddons.length > 0 && (
                <div className="mb-3">
                  <p>
                  {addonToDelete?.title} came with the following bundled addon(s). Select if you want to keep the bundled addon(s) installed after you delete {addonToDelete?.title}:
                  </p>
                  <ul className="list-group">
                    {nestedAddons.map((child) => (
                      <li
                        className="list-group-item d-flex align-items-center justify-content-between"
                        key={child.id}
                      >
                        <div>
                          <span>{child.title}</span>
                        </div>
                        <div className="form-check form-switch d-flex align-items-center gap-2">
                          <input
                            className="form-check-input bigger"
                            type="checkbox"
                            checked={selectedDeletions[child.id] || false}
                            onChange={() => handleToggle(child.id)}
                          />
                          <label className="form-check-label">
                            Delete
                          </label>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={onClose}
              >
                Cancel
              </button>
              {isInstallation && newAddon ? (
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleConfirm}
                >
                  Continue
                </button>
              ) : (
                <button
                  type="button"
                  className="btn btn-danger"
                  onClick={handleConfirm}
                >
                  Delete
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

export default DeleteConfirmationModal;