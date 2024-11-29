import React, { useState, useCallback, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { WEB_URL } from './../../config.js';

const EditServerModal = ({ show, onClose, user, server, refreshServers }) => {
    const [serverName, setServerName] = useState('');
    const [serverLogo, setServerLogo] = useState(null);
    const [serverLogoPreview, setServerLogoPreview] = useState('public/default-image.jpg');
    const [gameVersion, setGameVersion] = useState('');
    const [serverPath, setServerPath] = useState('');
    const [dirPath, setDirPath] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [validationMessage, setValidationMessage] = useState('');
    const [isSaveEnabled, setIsSaveEnabled] = useState(false);

    const [showDeleteModal, setShowDeleteModal] = useState(false); // State for delete modal
    const [isDeleting, setIsDeleting] = useState(false); // Loader for delete action

    const navigate = useNavigate(); // Hook for navigation

    const [toastMessage, setToastMessage] = useState('');
    const [toastType, setToastType] = useState('success');
    const [showToast, setShowToast] = useState(false);

    const gameVersions = [
        { value: 'vanilla', label: 'Vanilla', versionPrefix: '1' },
        { value: 'tbc', label: 'Burning Crusade', versionPrefix: '2' },
        { value: 'wotlk', label: 'Wrath of the Lich King', versionPrefix: '3' },
        { value: 'cata', label: 'Cataclysm', versionPrefix: '4' },
        { value: 'mop', label: 'Mists of Pandaria', versionPrefix: '5' },
    ];

    const showToastMessage = useCallback((message, type) => {
        setToastMessage(message);
        setToastType(type);
        setShowToast(true);

        const timeoutId = setTimeout(() => setShowToast(false), 5000);

        return () => clearTimeout(timeoutId);
    }, []);

    useEffect(() => {
        if (server) {
            populateFieldsFromServer(server);
        }
    }, [server]);

    useEffect(() => {
        if (!show) resetState();
    }, [show]);

    const resetState = () => {
        setServerName('');
        setServerLogo(null);
        setServerLogoPreview('public/default-image.jpg');
        setGameVersion('');
        setServerPath('');
        setValidationMessage('');
        setIsSaveEnabled(false);
    };

    const populateFieldsFromServer = (server) => {
        setServerName(server.s_name || '');
        setServerLogoPreview(server.s_image || 'public/default-image.jpg');
        setGameVersion(server.s_version || '');
        setServerPath(server.s_path || '');
        setValidationMessage('');
        setIsSaveEnabled(true);
    };

    const handleLogoSelect = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        // List of valid extensions
        const validExtensions = ['jpg', 'jpeg', 'png', 'webp'];

        // Extract file extension
        const fileExtension = file.name.split('.').pop().toLowerCase();

        // Validate file size
        if (file.size > 2 * 1024 * 1024) { // 2 MB
            showToastMessage('The selected image exceeds the maximum file size of 2MB.', 'light');
            e.target.value = ''; // Clear the input value
            return;
        }

        // Validate file extension
        if (!validExtensions.includes(fileExtension)) {
            showToastMessage('Please select a valid image file (JPG, PNG, WEBP).', 'light');
            e.target.value = ''; // Clear the input value
            return;
        }

        // Generate preview for valid images
        const reader = new FileReader();
        reader.onload = (e) => {
            setServerLogo(file);
            setServerLogoPreview(e.target.result);
        };
        reader.readAsDataURL(file);

        e.target.value = ''; // Clear the input value to allow re-selection
    };

    const handleRemoveLogo = () => {
        setServerLogo(null);
        setServerLogoPreview('public/default-image.jpg');
    };

    const handleFileSelect = async () => {
        try {
            const result = await window.electron.showOpenDialog({
                properties: ['openFile'],
                filters: [{ name: 'Executable Files', extensions: ['exe'] }],
            });
    
            if (result.length > 0) {
                const exePath = result[0];
                const directoryPath = exePath.substring(0, exePath.lastIndexOf("\\") || exePath.lastIndexOf("/"));
    
                setServerPath(exePath);
                setDirPath(directoryPath); // Update the dir_path state
    
                const version = await window.electron.checkWowVersion(exePath);
    
                if (!version) {
                    setValidationMessage(
                        'The selected file does not seem to be a valid World of Warcraft executable.'
                    );
                    setIsSaveEnabled(false);
                    return;
                }
    
                const cleanVersion = version.replace(/^Version\s/, '');
                const expansion = gameVersions.find((v) => v.value === gameVersion);
    
                if (expansion) {
                    const versionPrefix = cleanVersion.split('.')[0];
                    if (versionPrefix === expansion.versionPrefix) {
                        setValidationMessage(
                            `The .exe file appears to match the selected expansion (${expansion.label}).`
                        );
                        setIsSaveEnabled(true);
                    } else {
                        setValidationMessage(
                            `The game version doesn't match the ${expansion.label} expansion. This might corrupt your addons. Are you sure you want to continue?`
                        );
                        setIsSaveEnabled(false);
                    }
                }
            }
        } catch (err) {
            showToastMessage('Failed to select file. Please try again.', 'error');
            console.error('Error selecting file:', err);
        }
    };    

    const handleSubmit = async () => {
        if (!serverName || !gameVersion || !serverPath) {
            showToastMessage('Please fill in all required fields.', 'error');
            return;
        }
    
        setIsLoading(true);
    
        try {
            const tokenResult = await window.electron.retrieveToken();
            if (!tokenResult.success || !tokenResult.token) {
                showToastMessage('Error occurred. Please try again later.', 'error');
                return;
            }
    
            let newLogoUrl = server.s_image;
            const removeLogo = serverLogoPreview === '/default-image.jpg' && !serverLogo;
    
            if (serverLogo) {
                const formData = new FormData();
                formData.append('file', serverLogo);
    
                const uploadResponse = await axios.post(
                    `${WEB_URL}/wp-json/wp/v2/users/upload-server-logo`,
                    formData,
                    {
                        headers: {
                            Authorization: `Bearer ${tokenResult.token}`,
                            'Content-Type': 'multipart/form-data',
                        },
                    }
                );
    
                newLogoUrl = uploadResponse.data.attachment_url;
            }
    
            const sanitizedServerPath = serverPath.replace(/\\/g, '//');
            const sanitizedDirPath = serverPath.substring(0, serverPath.lastIndexOf("\\") || serverPath.lastIndexOf("/")).replace(/\\/g, '//');
    
            // Ensure s_dir is updated if s_path hasn't changed or is valid
            const updatedServer = {
                ...server,
                s_image: removeLogo ? null : newLogoUrl,
                old_logo_url: server.s_image,
                remove_logo: removeLogo,
                s_name: serverName,
                s_version: gameVersion,
                s_path: sanitizedServerPath,
                s_dir: serverPath === server.s_path ? server.s_dir : sanitizedDirPath, // Check if s_path has changed
            };
    
            await axios.post(
                `${WEB_URL}/wp-json/wp/v2/users/update-meta`,
                { meta: { user_servers: [updatedServer] } },
                {
                    headers: {
                        Authorization: `Bearer ${tokenResult.token}`,
                        'Content-Type': 'application/json',
                    },
                }
            );
    
            showToastMessage('Server updated successfully!', 'success');
            onClose();
            refreshServers();
        } catch (error) {
            console.error('Error updating server:', error);
            showToastMessage('Error occurred. Please try again later.', 'error');
        } finally {
            setIsLoading(false);
        }
    };    
    
    const handleDeleteServer = async () => {
        if (!server || !server.s_id || !user) {
            showToastMessage('Invalid server or user data.', 'error');
            return;
        }

        setIsDeleting(true);

        try {
            const tokenResult = await window.electron.retrieveToken();
            if (!tokenResult.success || !tokenResult.token) {
                showToastMessage('Unauthorized request.', 'error');
                setIsDeleting(false);
                return;
            }

            // Delete server via REST API
            const response = await axios.post(
                `${WEB_URL}/wp-json/wp/v2/users/delete-server`,
                { s_id: server.s_id },
                {
                    headers: {
                        Authorization: `Bearer ${tokenResult.token}`,
                        'Content-Type': 'application/json',
                    },
                }
            );

            if (response.data.message === 'Server deleted successfully') {
                showToastMessage('Server deleted successfully.', 'success');
                setShowDeleteModal(false);
                onClose();
                refreshServers();
            } else {
                showToastMessage('Failed to delete server. Please try again.', 'error');
            }
        } catch (error) {
            console.error('Error deleting server:', error);
            showToastMessage('An error occurred. Please try again.', 'error');
        } finally {
            setIsDeleting(false);
        }
    };


    return (
        <>
            {show && <div className="modal-overlay"></div>}
            <div className={`modal fade ${show ? 'show d-block' : ''}`} tabIndex="-1" role="dialog" style={{ display: show ? 'block' : 'none' }}>
                <div className="modal-dialog modal-dialog-centered modal-lg modal-dialog-scrollable modal-dark modal-add-user-server">
                    <div className="modal-content rounded-0">
                        <div className="modal-header">
                            <h5 className="modal-title">Edit Server</h5>
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
                                <form>
                                    {/* Server Name */}
                                    <div className="mb-4">
                                        <label htmlFor="serverName" className="form-label fw-medium">Name</label>
                                        <input
                                            type="text"
                                            className="form-control"
                                            id="serverName"
                                            value={serverName}
                                            onChange={(e) => setServerName(e.target.value)}
                                            required
                                        />
                                    </div>

                                    {/* Logo */}
                                    <div className="server-logo mb-4">
                                        <label className="form-label fw-medium">Logo</label>
                                        <div className="d-flex align-items-center gap-2">
                                            <img
                                                src={serverLogoPreview}
                                                alt="Server Logo"
                                                className="img-fluid"
                                                onClick={() => document.getElementById('editServerLogoInput').click()}
                                            />
                                            <input
                                                type="file"
                                                id="editServerLogoInput"
                                                accept="image/*"
                                                style={{ display: 'none' }}
                                                onChange={handleLogoSelect}
                                            />
                                            {(serverLogo || serverLogoPreview !== 'public/default-image.jpg') && (
                                                <button type="button" className="btn btn-secondary btn-sm" onClick={handleRemoveLogo}>
                                                    Remove Image
                                                </button>
                                            )}
                                        </div>
                                    </div>

                                    {/* Expansion */}
                                    <div className="server-game-version mb-4">
                                        <label className="form-label fw-medium">Expansion</label>
                                        <div className="d-flex flex-wrap gap-2">
                                            {gameVersions.map((version) => (
                                                <button
                                                    type="button"
                                                    key={version.value}
                                                    className={`btn ${gameVersion === version.value ? 'active' : 'btn-outline-secondary'}`}
                                                    onClick={() => {
                                                        setGameVersion(version.value);
                                                        setServerPath('');
                                                        setValidationMessage('');
                                                        setIsSaveEnabled(false);
                                                    }}
                                                >
                                                    {version.label}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Game Path */}
                                    <div className="mb-4 server-game-path position-relative">
                                        <label htmlFor="serverPath" className="form-label fw-medium mb-0">Game Path</label>
                                        <div id="pathHelpBlock" className="form-text text-muted fw-medium mt-0 mb-1">
                                            Select the executable <span className="fw-bold text-primary">(WoW.exe)</span> file that you use to play the game from your installation directory.
                                        </div>
                                        <div className="position-relative">
                                            <input
                                                type="text"
                                                className="form-control"
                                                id="serverPath"
                                                value={serverPath}
                                                placeholder="Select the WoW executable file"
                                                aria-describedby="pathHelpBlock"
                                                style={{ paddingRight: '90px' }}
                                                readOnly
                                                required
                                            />
                                            <button
                                                type="button"
                                                className="btn btn-browse position-absolute top-50 translate-middle-y"
                                                onClick={handleFileSelect}
                                                style={{ right: '10px', height: '80%', zIndex: 10 }}
                                            >
                                                Browse
                                            </button>
                                        </div>
                                    </div>

                                    {/* Validation Message */}
                                    {validationMessage && (
                                        <div className={`alert ${isSaveEnabled ? 'alert-path-success' : 'alert-path-info'} border-0 fw-bold`}>
                                            <div className="d-flex align-items-center gap-2">
                                                <i className={`bi ${isSaveEnabled ? 'bi-check-circle-fill' : 'bi-exclamation-circle-fill'}`}></i>
                                                <div>{validationMessage}</div>
                                            </div>
                                            {!isSaveEnabled && validationMessage.includes('This might corrupt your addons') && (
                                                <button
                                                    className="btn btn-sm btn-secondary mt-2"
                                                    onClick={() => setIsSaveEnabled(true)}
                                                >
                                                    Confirm Selection
                                                </button>
                                            )}
                                        </div>
                                    )}
                                </form>
                            )}
                        </div>
                        <div className="modal-footer justify-content-between">
                            {!isLoading && (
                                <>
                                    <button
                                        type="button"
                                        className="btn btn-danger"
                                        onClick={() => setShowDeleteModal(true)}
                                    >
                                        <i className="bi bi-trash"></i> Delete Server
                                    </button>
                                    <div className="d-flex align-items-center gap-2">
                                        <button type="button" className="btn btn-secondary" onClick={onClose}>
                                            <i className="bi bi-x-lg"></i> Cancel
                                        </button>
                                        <button
                                            type="button"
                                            className="btn btn-primary"
                                            onClick={handleSubmit}
                                            disabled={!isSaveEnabled}
                                        >
                                            <i className="bi bi-check-lg"></i> Save Changes
                                        </button>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Toast Notifications */}
            {showToast && (
                <div className="toast-container position-fixed bottom-0 end-0 p-3" style={{ zIndex: 11 }}>
                    <div className={`toast show text-bg-${toastType}`} role="alert" aria-live="assertive" aria-atomic="true">
                        <div className="toast-header">
                            <strong className="me-auto">
                                <i className="bi bi-bell"></i> Notification
                            </strong>
                            <button type="button" className="btn-close btn-close-white" aria-label="Close" onClick={() => setShowToast(false)}></button>
                        </div>
                        <div className="toast-body">{toastMessage}</div>
                    </div>
                </div>
            )}

            {/* Delete Confirmation Modal */}
            {showDeleteModal && (
                <>
                    <div className="modal-overlay delete-modal-overlay"></div>
                    <div className="modal fade show d-block modal-delete" tabIndex="-1" role="dialog">
                        <div className="modal-dialog modal-dialog-centered modal-dark">
                            <div className="modal-content">
                                <div className="modal-body">
                                    <p className="text-danger fw-medium h5">
                                        <i className="bi bi-exclamation-circle-fill"></i> Hold up!
                                    </p>
                                    <p className="fw-medium">
                                        Are you sure you want to delete this server instance? This action
                                        is permanent and can't be undone.
                                    </p>
                                </div>
                                <div className="modal-footer justify-content-between border-0">
                                    <button
                                        type="button"
                                        className="btn btn-outline-secondary-2"
                                        onClick={() => setShowDeleteModal(false)}
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="button"
                                        className="btn btn-danger"
                                        onClick={handleDeleteServer}
                                        disabled={isDeleting}
                                    >
                                        {isDeleting ? (
                                            <span className="spinner-border spinner-border-sm me-2"></span>
                                        ) : (
                                            <i></i>
                                        )}
                                        Yes, delete
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </>
            )}
        </>
    );
};

export default EditServerModal;