import React, { useState, useEffect } from 'react';

const ExportModal = ({ show, onClose, installedAddons, showToastMessage }) => {
    const [selectedAddons, setSelectedAddons] = useState([]);
    const [exportCode, setExportCode] = useState('');
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (show) {
            setIsLoading(true);
            if (installedAddons) {
                setIsLoading(false);
            }
        }
    }, [show, installedAddons]);

    const handleAddonSelect = (addon) => {
        let updatedSelectedAddons;
        if (selectedAddons.includes(addon)) {
            updatedSelectedAddons = selectedAddons.filter((a) => a !== addon);
        } else {
            updatedSelectedAddons = [...selectedAddons, addon];
        }

        setSelectedAddons(updatedSelectedAddons);

        // Reset the export code if no addons are selected
        if (updatedSelectedAddons.length === 0) {
            setExportCode('');
        }
    };

    const handleExport = () => {
        const addonIds = selectedAddons.map(addon => addon.id);
        const code = btoa(JSON.stringify(addonIds)); // Convert the selected addon IDs to base64
        setExportCode(code); // Set the export code in the state
    };

    const handleCopyExportCode = () => {
        navigator.clipboard.writeText(exportCode);
        showToastMessage("Export code copied to clipboard!", "success");
    };

    return (
        <>
            {show && <div className="modal-overlay"></div>}
            <div className={`modal fade ${show ? 'show d-block' : ''}`} tabIndex="-1" role="dialog" style={{ display: show ? 'block' : 'none' }}>
                <div className="modal-dialog modal-dialog-centered modal-dialog-scrollable modal-xl modal-dark modal-switch-variations modal-fixed-height">
                    <div className="modal-content">
                        <div className="modal-header">
                            <h5 className="modal-title">Export Addons</h5>
                            <button type="button" className="btn-close btn-close-white" aria-label="Close" onClick={onClose}></button>
                        </div>
                        <div className="modal-body">
                            {isLoading ? (
                                <div className="text-center">
                                    <div className="spinner-border text-light" role="status">
                                        <span className="visually-hidden">Loading...</span>
                                    </div>
                                </div>
                            ) : Object.keys(installedAddons).length === 0 ? ( // Check if there are no installed addons
                                <div className="text-muted fw-medium">
                                    <p>You don't have any installed addons available for exporting.</p>
                                </div>
                            ) : (
                                <div className="list-group">
                                    {Object.values(installedAddons).map((addon) => (
                                        <div
                                            key={addon.id}
                                            className={`list-group-item list-group-item-action d-flex justify-content-between align-items-center`}
                                            onClick={() => handleAddonSelect(addon)}
                                            style={{ cursor: 'pointer' }}
                                        >
                                            <div className="d-flex align-items-center">
                                                <img
                                                    src={addon.featured_image || 'public/default-image.jpg'}
                                                    alt={addon.title}
                                                    className="me-3 rounded-3"
                                                    style={{ width: '50px', height: '50px', objectFit: 'cover' }}
                                                />
                                                <h6 className="mb-0">{addon.title}</h6>
                                            </div>
                                            {selectedAddons.includes(addon) && (
                                                <span className="text-success"><i className="bi bi-check-circle-fill text-success me-1"></i> Selected</span>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                        <div className="modal-footer">
                            {exportCode && selectedAddons.length > 0 && (
                                <div className="input-group input-group-secondary mt-2 mb-5">
                                    <span className="text-muted mb-1 d-block w-100">Your export code is ready to be shared!</span>
                                    <input
                                        type="text"
                                        className="form-control"
                                        value={exportCode}
                                        readOnly
                                        onClick={handleCopyExportCode}
                                        style={{ cursor: 'pointer' }} />
                                    <button className="btn btn-secondary btn-secondary-2" onClick={handleCopyExportCode}>
                                        Copy Code
                                    </button>
                                </div>
                            )}
                            <button type="button" className="btn btn-secondary btn-secondary-2" onClick={onClose}><i className="bi bi-x-lg"></i> Cancel</button>
                            <button
                                type="button"
                                className="btn btn-primary"
                                onClick={handleExport}
                                disabled={selectedAddons.length === 0}
                            >
                                <i className="bi bi-copy"></i> Export
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
};

export default ExportModal;