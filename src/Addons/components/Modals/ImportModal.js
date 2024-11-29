import React, { useState, useEffect } from 'react';

const ImportModal = ({ show, onClose, onImportAddons }) => {
    const [importCode, setImportCode] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [errorMessage, setErrorMessage] = useState(''); // New state for error message

    const handleImport = async () => {
        try {
            setIsLoading(true);
            setErrorMessage(''); // Reset any previous error messages

            const addonIds = JSON.parse(atob(importCode)); // Decode and parse the import code

            if (!Array.isArray(addonIds) || addonIds.some(id => typeof id !== 'number')) {
                throw new Error('Invalid code'); // If the parsed data is not an array of numbers, throw an error
            }

            await onImportAddons(addonIds);
            setIsLoading(false);
            onClose();
        } catch (error) {
            setIsLoading(false);
            setErrorMessage('Invalid import code. Please check and try again.'); // Set error message
        }
    };

    useEffect(() => {
        if (!show) {
            setImportCode(''); // Reset import code when modal is closed
            setIsLoading(false); // Reset loading state
            setErrorMessage(''); // Reset error message when closing the modal
        }
    }, [show]);

    return (
        <>
            {show && <div className="modal-overlay"></div>}
            <div className={`modal fade ${show ? 'show d-block' : ''}`} tabIndex="-1" role="dialog" style={{ display: show ? 'block' : 'none' }}>
                <div className="modal-dialog modal-dialog-centered modal-lg modal-dialog-scrollable modal-dark modal-fixed-height">
                    <div className="modal-content">
                        <div className="modal-header">
                            <h5 className="modal-title">Import Addons</h5>
                            <button type="button" className="btn-close btn-close-white" aria-label="Close" onClick={onClose}></button>
                        </div>
                        <div className="modal-body">
                            {isLoading ? (
                                <div className="text-center">
                                    <div className="spinner-border text-light" role="status">
                                        <span className="visually-hidden">Loading...</span>
                                    </div>
                                </div>
                            ) : (
                                <>
                                    {errorMessage && (
                                        <div className="alert alert-danger" role="alert">
                                            {errorMessage}
                                        </div>
                                    )}
                                    <textarea
                                        className="form-control"
                                        placeholder="Paste your code here"
                                        value={importCode}
                                        onChange={(e) => setImportCode(e.target.value)}
                                    ></textarea>
                                </>
                            )}
                        </div>
                        <div className="modal-footer">
                            {!isLoading && (
                                <>
                                    <button type="button" className="btn btn-secondary btn-secondary-2" onClick={onClose}><i className="bi bi-x-lg"></i> Cancel</button>
                                    <button type="button" className="btn btn-primary" onClick={handleImport} disabled={!importCode}>
                                        <i className="bi bi-copy"></i> Import
                                    </button>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
};

export default ImportModal;