import React, { useState, useEffect } from 'react';

const ReportModal = ({ show, onClose, onSubmit, addonName }) => {
    const [details, setDetails] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');

    const handleReportSubmit = async () => {
        if (details.trim() === '') {
            setErrorMessage('Please provide some details about the issue.');
            return;
        }

        try {
            setIsLoading(true);
            setErrorMessage('');

            await onSubmit(details);

            setIsLoading(false);
            onClose();
        } catch (error) {
            setIsLoading(false);
            setErrorMessage('Failed to submit the report. Please try again.');
        }
    };

    useEffect(() => {
        if (!show) {
            setDetails('');
            setIsLoading(false);
            setErrorMessage('');
        }
    }, [show]);

    return (
        <>
            {show && <div className="modal-overlay"></div>}
            <div className={`modal ${show ? 'show' : ''}`} tabIndex="-1" style={{ display: show ? 'block' : 'none' }}>
                <div className="modal-dialog modal-dialog-centered modal-lg modal-dialog-scrollable modal-dark modal-fixed-height">
                    <div className="modal-content">
                        <div className="modal-header">
                            <h5 className="modal-title">Report Addon: {addonName}</h5>
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
                                        placeholder="Describe the issue you are experiencing with this addon"
                                        value={details}
                                        onChange={(e) => setDetails(e.target.value)}
                                    ></textarea>
                                </>
                            )}
                        </div>
                        <div className="modal-footer">
                            {!isLoading && (
                                <>
                                    <button
                                        type="button"
                                        className="btn btn-secondary"
                                        onClick={onClose}
                                    >
                                        Cancel
                                    </button>

                                    <button
                                        type="button"
                                        className="btn btn-primary"
                                        onClick={handleReportSubmit}
                                        disabled={!details}
                                    >
                                        Submit Report
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

export default ReportModal;