import React, { useState } from 'react';
import 'bootstrap/dist/css/bootstrap.min.css';

const AddonSelectionModal = ({ matchedAddons, onSelectAddon, onCancel }) => {
  // State to track the loading state of the currently selected addon
  const [loadingAddonId, setLoadingAddonId] = useState(null);

  const handleAddonSelection = async (addon) => {
    setLoadingAddonId(addon.id); // Set the loading state for the selected addon
    await onSelectAddon(addon); // Call the onSelectAddon handler
    setLoadingAddonId(null); // Reset loading state after selection
    window.location.reload(); // Refresh the page after successful selection and installation
  };

  // Sort the matched addons to prioritize any logic (you can adjust this as needed)
  const sortedAddons = [...matchedAddons].sort((a, b) => {
    return a.title.localeCompare(b.title); // Sort alphabetically by title, for example
  });

  return (
    <>
      <div className="modal-overlay"></div>
      <div className="modal fade show d-block" tabIndex="-1" role="dialog" style={{ display: 'block' }}>
        <div className="modal-dialog modal-dialog-centered modal-dialog-scrollable modal-xl modal-dark modal-switch-variations modal-fixed-height">
          <div className="modal-content rounded-0">
            <div className="modal-header">
              <h5 className="modal-title">Select Matching Addon</h5>
              {/* <button type="button" className="btn-close btn-close-white" aria-label="Close" onClick={onCancel}></button> */}
            </div>
            <div className="modal-body">
              <p className="text-muted fw-medium mb-3">
                Multiple matching addons were found for <strong>{sortedAddons[0]?.custom_fields.title_toc || sortedAddons[0]?.title}</strong>.
                Please select the version of the addon you have installed:
              </p>
              <div className="list-group">
                {sortedAddons.map((addon) => (
                  <div
                    key={addon.id}
                    className="list-group-item list-group-item-action d-flex justify-content-between align-items-center"
                    style={{ cursor: 'pointer' }}
                  >
                    <div className="d-flex align-items-center">
                      <img
                        src={addon.featured_image || 'public/default-image.jpg'}
                        alt={addon.title}
                        className="me-3"
                        style={{ width: '50px', height: '50px', objectFit: 'cover' }}
                      />
                      <div>
                        <h6 className="mb-0">{addon.title}</h6>
                        {/* <small className="text-muted">{addon.custom_fields.title_toc}</small> */}
                      </div>
                    </div>
                    <button
                      className="btn btn-outline-secondary-2 rounded-0"
                      onClick={() => handleAddonSelection(addon)}
                      disabled={loadingAddonId !== null && loadingAddonId !== addon.id} // Disable all buttons except the one being loaded
                    >
                      {loadingAddonId === addon.id ? (
                        <span className="spinner-border spinner-border-sm text-light me-1" role="status" aria-hidden="true"></span>
                      ) : (
                        "Select"
                      )}
                    </button>
                  </div>
                ))}
              </div>
            </div>
            {/* <div className="modal-footer">
              <button type="button" className="btn btn-secondary rounded-0" onClick={onCancel} disabled={loadingAddonId !== null}>
                Cancel
              </button>
            </div> */}
          </div>
        </div>
      </div>
    </>
  );
};

export default AddonSelectionModal;