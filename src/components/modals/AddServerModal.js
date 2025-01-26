import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';
import { WEB_URL } from './../../config.js';

const AddServerModal = ({ show, onClose, user, refreshServers }) => {
    const [serverName, setServerName] = useState('');
    const [serverLogo, setServerLogo] = useState(null);
    const [serverLogoPreview, setServerLogoPreview] = useState('public/default-image.jpg');
    const [gameVersion, setGameVersion] = useState('');
    const [serverPath, setServerPath] = useState('');
    const [serverDir, setServerDir] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [validationMessage, setValidationMessage] = useState('');
    const [isAddServerEnabled, setIsAddServerEnabled] = useState(false);

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
        setTimeout(() => setShowToast(false), 5000);
    }, []);

    useEffect(() => {
        if (!show) {
            resetState();
        }
    }, [show]);

    const resetState = () => {
        setServerName('');
        setServerLogo(null);
        setServerLogoPreview('public/default-image.jpg');
        setGameVersion('');
        setServerPath('');
        setValidationMessage('');
        setIsAddServerEnabled(false);
    };

    const handleFileSelect = async () => {
        try {
            const result = await window.electron.showOpenDialog({
                properties: ['openFile'],
                filters: [{ name: 'Executable Files', extensions: ['exe'] }],
            });

            if (result.length > 0) {
                const exePath = result[0];
                const directoryPath = exePath.substring(0, exePath.lastIndexOf("\\") || exePath.lastIndexOf("/")); // Extract directory

                setServerPath(exePath);
                setServerDir(directoryPath);

                // Validate the selected .exe file
                const version = await window.electron.checkWowVersion(exePath);

                if (!version) {
                    setValidationMessage('The selected file does not seem to be a valid World of Warcraft executable in the correct directory.');
                    setIsAddServerEnabled(false);
                    return;
                }

                const cleanVersion = version.replace(/^Version\s/, '');
                const expansion = gameVersions.find(v => v.value === gameVersion);

                if (expansion) {
                    const versionPrefix = cleanVersion.split('.')[0];

                    if (versionPrefix === expansion.versionPrefix) {
                        setValidationMessage(`The .exe file appears to match the selected expansion (${expansion.label}).`);
                        setIsAddServerEnabled(true);
                    } else {
                        setValidationMessage(`The .exe file is a World of Warcraft executable, but it does not match the selected expansion (${expansion.label}).`);
                        setIsAddServerEnabled(false);
                    }
                }
            }
        } catch (err) {
            showToastMessage('Failed to select file. Please try again.', 'light');
            console.error('Error selecting file:', err);
        }
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
        document.getElementById('addServerLogoInput').value = '';
    };

    const handleSubmit = async () => {
        if (!serverName || !gameVersion || !serverPath) {
            showToastMessage('Please fill in all required fields.', 'light');
            return;
        }

        setIsLoading(true);

        try {
            const tokenResult = await window.electron.retrieveToken();
            if (!tokenResult.success || !tokenResult.token) {
                showToastMessage('Error occurred. Please try again later.', 'light');
                return;
            }

            let logoUrl = '';
            if (serverLogo) {
                const formData = new FormData();
                formData.append('file', serverLogo);

                const uploadResponse = await axios.post(`${WEB_URL}/wp-json/wp/v2/users/upload-server-logo`, formData, {
                    headers: {
                        Authorization: `Bearer ${tokenResult.token}`,
                        'Content-Type': 'multipart/form-data',
                    },
                });

                logoUrl = uploadResponse.data.attachment_url;
            }

            const sanitizedServerPath = serverPath.replace(/\\/g, '//');
            const sanitizedServerDir = serverDir.replace(/\\/g, '//'); // Use sanitized directory path

            let serverId = uuidv4();
            let isUnique = false;

            while (!isUnique) {
                const response = await axios.post(`${WEB_URL}/wp-json/wp/v2/validate-server-id`, { s_id: serverId }, {
                    headers: {
                        Authorization: `Bearer ${tokenResult.token}`,
                        'Content-Type': 'application/json',
                    },
                });

                if (response.data.isUnique) {
                    isUnique = true;
                } else {
                    serverId = uuidv4();
                }
            }

            const newServer = [
                {
                    s_image: logoUrl,
                    s_id: serverId,
                    s_name: serverName,
                    s_version: gameVersion,
                    s_path: sanitizedServerPath,
                    s_dir: sanitizedServerDir,
                },
            ];

            await axios.post(`${WEB_URL}/wp-json/wp/v2/users/update-meta`, { meta: { user_servers: newServer } }, {
                headers: {
                    Authorization: `Bearer ${tokenResult.token}`,
                },
            });

            showToastMessage('The server instance was added to your profile!', 'light');
            onClose();
            refreshServers();
        } catch (error) {
            console.error('Error adding server:', error);
            showToastMessage('Error occurred. Please try again later.', 'light');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <>
            {show && <div className="modal-overlay"></div>}
            <div className={`modal fade ${show ? 'show d-block' : ''}`} tabIndex="-1" role="dialog" style={{ display: show ? 'block' : 'none' }}>
                <div className="modal-dialog modal-dialog-centered modal-lg modal-dialog-scrollable modal-dark modal-add-user-server">
                    <div className="modal-content">
                        <div className="modal-header">
                            <h5 className="modal-title">Add Server</h5>
                            <button
                                type="button"
                                className="btn-close btn-close-white"
                                aria-label="Close"
                                onClick={onClose}
                            ></button>
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
                                    <div className="server-logo mb-4">
                                        <label className="form-label fw-medium">Logo</label>
                                        <div className="d-flex align-items-center gap-2">
                                            <img
                                                src={serverLogoPreview}
                                                alt="Server Logo"
                                                className="img-fluid"
                                                onClick={() => document.getElementById('addServerLogoInput').click()}
                                            />

                                            <input
                                                type="file"
                                                id="addServerLogoInput"
                                                accept="image/*"
                                                style={{ display: 'none' }}
                                                onChange={handleLogoSelect}
                                            />
                                            {serverLogo && (
                                                <button
                                                    type="button"
                                                    className="btn btn-secondary btn-sm"
                                                    onClick={handleRemoveLogo}
                                                >
                                                    Remove Image
                                                </button>
                                            )}
                                        </div>
                                    </div>
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
                                                        setIsAddServerEnabled(false);
                                                    }}
                                                >
                                                    {version.label}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                    <div className="mb-4 server-game-path position-relative">
                                        <label htmlFor="serverPath" className="form-label fw-medium mb-0">Game Path</label>
                                        <div id="pathHelpBlock" className="form-text text-muted fw-medium mt-0 mb-1">
                                            Select the executable <span className="fw-bold text-primary">(WoW.exe)</span> file that you use to play the game <br></br>from your installation directory.
                                        </div>
                                        <div className="position-relative">
                                            <input
                                                type="text"
                                                className="form-control"
                                                id="serverPath"
                                                value={serverPath}
                                                placeholder="Select the WoW executable file"
                                                aria-describedby="pathHelpBlock"
                                                readOnly
                                                disabled={!gameVersion}
                                                style={{ paddingRight: '90px' }}
                                            />
                                            <button
                                                type="button"
                                                className="btn btn-browse position-absolute top-50 translate-middle-y"
                                                onClick={handleFileSelect}
                                                style={{ right: '10px', height: '80%', zIndex: 10 }}
                                                disabled={!gameVersion}
                                            >
                                                Browse
                                            </button>
                                        </div>
                                    </div>
                                    {validationMessage && (
                                        <div
                                            className={`alert ${isAddServerEnabled ? 'alert-path-success' : 'alert-path-info'} border-0 fw-bold`}
                                        >
                                            <div className="d-flex align-items-center gap-2">
                                                <i className={`bi ${isAddServerEnabled ? 'bi-check-circle-fill' : 'bi-exclamation-circle-fill'}`}></i>
                                                <div>{validationMessage}</div>
                                            </div>
                                            {!isAddServerEnabled && validationMessage.includes('does not match the selected expansion') && (
                                                <button
                                                    className="btn btn-sm btn-secondary mt-2"
                                                    onClick={() => setIsAddServerEnabled(true)}
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
                                        className="btn btn-secondary"
                                        onClick={onClose}
                                    >
                                        <i className="bi bi-x-lg"></i> Cancel
                                    </button>
                                    <button
                                        type="button"
                                        className="btn btn-primary"
                                        onClick={handleSubmit}
                                        disabled={!isAddServerEnabled}
                                    >
                                        <i className="bi bi-plus-lg"></i> Add Server
                                    </button>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            </div>
            {/* Toast Notifications */}
            <div className="toast-container position-fixed bottom-0 end-0 p-3" style={{ zIndex: 11 }}>
                <div className={`toast ${showToast ? 'show' : ''}`} role="alert" aria-live="assertive" aria-atomic="true">
                    <div className={`toast-header text-${toastType}`}>
                        <strong className="me-auto"><i className="bi bi-bell"></i> Notification</strong>
                        <button
                            type="button"
                            className="btn-close btn-close-white"
                            data-bs-dismiss="toast"
                            aria-label="Close"
                            onClick={() => setShowToast(false)}
                        ></button>
                    </div>
                    <div className="toast-body">{toastMessage}</div>
                </div>
            </div>
        </>
    );
};

export default AddServerModal;