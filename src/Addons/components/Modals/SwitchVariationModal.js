import React, { useState } from 'react';
import 'bootstrap/dist/css/bootstrap.min.css';

const SwitchVariationModal = ({ show, onHide, availableVariations, onSwitchVariation, currentAddon, loading }) => {
  // Filter and sort the available variations to show only published addons and have the current active addon first
  const publishedVariations = availableVariations.filter(variation => variation.status === 'publish');

  const sortedVariations = [...publishedVariations].sort((a, b) => {
    if (a.id === currentAddon?.id) return -1;
    if (b.id === currentAddon?.id) return 1;
    return 0;
  });

  // Loading state to handle the spinner
  const [loadingVariationId, setLoadingVariationId] = useState(null);

  const handleSwitch = async (variation) => {
    setLoadingVariationId(variation.id); // Show loading spinner for this variation
    await onSwitchVariation(variation); // Call the switch handler passed from the parent
    setLoadingVariationId(null); // Hide loading spinner after switching
  };

  return (
    <>
      {show && <div className="modal-overlay"></div>}
      <div className={`modal fade ${show ? 'show d-block' : ''}`} tabIndex="-1" role="dialog" style={{ display: show ? 'block' : 'none' }}>
        <div className="modal-dialog modal-dialog-centered modal-dialog-scrollable modal-xl modal-dark modal-switch-variations modal-fixed-height">
          <div className="modal-content rounded-0">
            <div className="modal-header">
              <h5 className="modal-title">Switch Addon Variation</h5>
              <button type="button" className="btn-close btn-close-white" aria-label="Close" onClick={onHide}></button>
            </div>
            <div className="modal-body">
              {loading ? (
                // Show spinner while variations are being fetched
                <div className="d-flex justify-content-center align-items-center" style={{ height: '200px' }}>
                  <div className="spinner-border text-light" role="status">
                    <span className="visually-hidden">Loading...</span>
                  </div>
                </div>
              ) : (
                <>
                  <p className="text-muted fw-medium mb-3">Select the variation you would like to activate</p>
                  <div className="list-group">
                    {sortedVariations.map((variation) => {
                      const isActive = currentAddon && variation.id === currentAddon.id;

                      return (
                        <div
                          key={variation.id}
                          className={`list-group-item list-group-item-action d-flex justify-content-between align-items-center ${isActive ? 'active-variation' : ''}`}
                          style={{ cursor: isActive ? 'default' : 'pointer' }}
                        >
                          <div className="d-flex align-items-center">
                            <img
                              src={variation.featured_image || 'public/default-image.jpg'}
                              alt={variation.title}
                              className="me-3"
                              style={{ width: '50px', height: '50px', objectFit: 'cover' }}
                            />
                            <div>
                              <h6 className="mb-0">{variation.title}</h6>
                            </div>
                          </div>
                          {isActive ? (
                            <span className="text-success"><i className="bi bi-check-circle-fill me-1"></i> Activated</span>
                          ) : (
                            <button
                              className="btn btn-outline-secondary-2 rounded-0"
                              onClick={() => handleSwitch(variation)}
                              disabled={!!loadingVariationId}
                            >
                              {loadingVariationId === variation.id ? (
                                <span className="spinner-border spinner-border-sm text-light me-1" role="status" aria-hidden="true"></span>
                              ) : (
                                <i className="bi bi-arrow-left-right me-1"></i>
                              )}
                              Switch
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default SwitchVariationModal;