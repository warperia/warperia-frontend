import React, { useState, useEffect } from "react";
import Select from 'react-select';

const ModificationsModal = ({ show, onClose, server }) => {
    const [ffxDeathEnabled, setFfxDeathEnabled] = useState(false);
    const [ffxGlowEnabled, setFfxGlowEnabled] = useState(false);
    const [screenshotQuality, setScreenshotQuality] = useState("default");
    const [checkAddonVersionEnabled, setCheckAddonVersionEnabled] = useState(false);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (show && server?.s_dir) {
            checkConfigSettings();
        }
    }, [show, server]);

    const checkConfigSettings = async () => {
        setLoading(true);
        setError(null);

        try {
            const configPath = await window.electron.pathJoin(server.s_dir, "WTF", "Config.wtf");
            const configExists = await window.electron.fileExists(configPath);

            if (!configExists) {
                setError("WTF folder or Config.wtf file does not exist. Please launch the game at least once before making modifications.");
                setLoading(false);
                return;
            }

            const configContent = await window.electron.readFile(configPath);
            const lines = configContent.split("\n").map(line => line.trim());

            // Check for ffxDeath setting
            const ffxDeathLine = lines.find(line => line.toLowerCase().startsWith("set ffxdeath"));
            if (ffxDeathLine) {
                const value = ffxDeathLine.match(/"([^"]+)"/)?.[1];
                setFfxDeathEnabled(value === "1");
            } else {
                setFfxDeathEnabled(false);
            }

            // Check for ffxGlow setting
            const ffxGlowLine = lines.find(line => line.toLowerCase().startsWith("set ffxglow"));
            if (ffxGlowLine) {
                const value = ffxGlowLine.match(/"([^"]+)"/)?.[1];
                setFfxGlowEnabled(value === "1");
            } else {
                setFfxGlowEnabled(false);
            }

            // Check for screenshotQuality setting
            const screenshotQualityLine = lines.find(line => line.toLowerCase().startsWith("set screenshotquality"));
            if (screenshotQualityLine) {
                const value = screenshotQualityLine.match(/"([^"]+)"/)?.[1];
                setScreenshotQuality(value === "10" ? "high" : "default");
            } else {
                setScreenshotQuality("default");
            }

            // Check for checkAddonVersion setting
            const checkAddonVersionLine = lines.find(line => line.toLowerCase().startsWith("set checkaddonversion"));
            if (checkAddonVersionLine) {
                const value = checkAddonVersionLine.match(/"([^"]+)"/)?.[1];
                setCheckAddonVersionEnabled(value === "0");
            } else {
                setCheckAddonVersionEnabled(false);
            }

        } catch (err) {
            console.error("Error reading Config.wtf:", err);
            setError("Failed to read Config.wtf. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    const handleToggleFfxDeath = async () => {
        await toggleSetting("ffxDeath", ffxDeathEnabled, setFfxDeathEnabled);
    };

    const handleToggleFfxGlow = async () => {
        await toggleSetting("ffxGlow", ffxGlowEnabled, setFfxGlowEnabled);
    };

    const handleScreenshotQualityChange = async (e) => {
        const quality = e.target.value;
        setScreenshotQuality(quality);
        await updateScreenshotQuality(quality);
    };

    const handleToggleCheckAddonVersion = async () => {
        await toggleSetting("checkAddonVersion", checkAddonVersionEnabled, setCheckAddonVersionEnabled);
    };

    const toggleSetting = async (settingName, currentValue, setValue) => {
        try {
            const configPath = await window.electron.pathJoin(server.s_dir, "WTF", "Config.wtf");
            const configExists = await window.electron.fileExists(configPath);

            if (!configExists) {
                setError("WTF folder or Config.wtf file does not exist. Please launch the game at least once before making modifications.");
                return;
            }

            const configContent = await window.electron.readFile(configPath);
            const lines = configContent.split("\n").map(line => line.trim());

            const settingLineIndex = lines.findIndex(line => line.toLowerCase().startsWith(`set ${settingName.toLowerCase()}`));
            let newValue;

            // Special handling for checkAddonVersion
            if (settingName === "checkAddonVersion") {
                newValue = currentValue ? "1" : "0"; // "0" means enabled, "1" means disabled
            } else {
                newValue = currentValue ? "0" : "1"; // Default behavior for other settings
            }

            const newLine = `SET ${settingName} "${newValue}"`;

            if (settingLineIndex >= 0) {
                lines[settingLineIndex] = newLine;
            } else {
                lines.push(newLine);
            }

            await window.electron.overwriteFile(configPath, lines.join("\n"));
            setValue(!currentValue); // Toggle the state
        } catch (err) {
            console.error(`Error updating ${settingName}:`, err);
            setError(`Failed to update ${settingName}. Please try again.`);
        }
    };

    const updateScreenshotQuality = async (quality) => {
        try {
            const configPath = await window.electron.pathJoin(server.s_dir, "WTF", "Config.wtf");
            const configExists = await window.electron.fileExists(configPath);

            if (!configExists) {
                setError("WTF folder or Config.wtf file does not exist. Please launch the game at least once before making modifications.");
                return;
            }

            const configContent = await window.electron.readFile(configPath);
            const lines = configContent.split("\n").map(line => line.trim());

            const screenshotQualityLineIndex = lines.findIndex(line => line.toLowerCase().startsWith("set screenshotquality"));
            const newValue = quality === "high" ? "10" : "3";
            const newLine = `SET screenshotQuality "${newValue}"`;

            if (screenshotQualityLineIndex >= 0) {
                lines[screenshotQualityLineIndex] = newLine;
            } else {
                lines.push(newLine);
            }

            await window.electron.overwriteFile(configPath, lines.join("\n"));
        } catch (err) {
            console.error("Error updating screenshotQuality:", err);
            setError("Failed to update screenshot quality. Please try again.");
        }
    };

    return (
        <>
            {show && <div className="modal-overlay"></div>}
            <div
                className={`modal fade ${show ? "show d-block" : ""}`}
                tabIndex="-1"
                role="dialog"
                style={{ display: show ? "block" : "none" }}
            >
                <div className="modal-dialog modal-dialog-centered modal-xl modal-dialog-scrollable modal-dark">
                    <div className="modal-content">
                        <div className="modal-header">
                            <h5 className="modal-title">Game Modifications</h5>
                            <button
                                type="button"
                                className="btn-close btn-close-white"
                                aria-label="Close"
                                onClick={onClose}
                            ></button>
                        </div>
                        <div className="modal-body">
                            {loading ? (
                                <div className="text-center">
                                    <div className="spinner-border text-light" role="status">
                                        <span className="visually-hidden">Loading...</span>
                                    </div>
                                </div>
                            ) : error ? (
                                <div className="alert alert-path-info" role="alert">
                                    <p class="mb-1 h6 fw-bold">Error</p>
                                    {error}
                                </div>
                            ) : (
                                <>
                                    <div className="modification-item mb-4">
                                        <div className="d-flex justify-content-between align-items-center">
                                            <div>
                                                <h6>Death Effects</h6>
                                                <p className="text-muted mb-0">Control the visibility of the grey death effects while you are corpse running<br></br> after bad risk calculations.</p>
                                            </div>
                                            <div className="form-check form-switch">
                                                <input
                                                    className="form-check-input bigger"
                                                    type="checkbox"
                                                    role="switch"
                                                    id="ffxDeathSwitch"
                                                    checked={ffxDeathEnabled}
                                                    onChange={handleToggleFfxDeath}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                    <div className="modification-item mb-4">
                                        <div className="d-flex justify-content-between align-items-center">
                                            <div>
                                                <h6>Glow Effects</h6>
                                                <p className="text-muted mb-0">Glowing effects make the game more immersive and pretty but it can also<br></br> harm your eyes during the night.</p>
                                            </div>
                                            <div className="form-check form-switch">
                                                <input
                                                    className="form-check-input bigger"
                                                    type="checkbox"
                                                    role="switch"
                                                    id="ffxGlowSwitch"
                                                    checked={ffxGlowEnabled}
                                                    onChange={handleToggleFfxGlow}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                    <div className="modification-item mb-4">
                                        <div className="d-flex justify-content-between align-items-center">
                                            <div>
                                                <h6>Screenshot Quality</h6>
                                                <p className="text-muted mb-0">Adjust the quality of your in-game screenshots.</p>
                                            </div>
                                            <div>
                                                <select
                                                    value={screenshotQuality}
                                                    onChange={handleScreenshotQualityChange}
                                                    className="rounded default-select"
                                                >
                                                    <option value="default">Default</option>
                                                    <option value="high">Highest</option>
                                                </select>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="modification-item mb-4">
                                        <div className="d-flex justify-content-between align-items-center">
                                            <div>
                                                <h6>Allow Outdated Addons</h6>
                                                <p className="text-muted mb-0">Enable this to allow addons to load even if they are out of date. It's highly recommended<br></br> to keep this setting <strong>enabled</strong>.</p>
                                            </div>
                                            <div className="form-check form-switch">
                                                <input
                                                    className="form-check-input bigger"
                                                    type="checkbox"
                                                    role="switch"
                                                    id="checkAddonVersionSwitch"
                                                    checked={checkAddonVersionEnabled}
                                                    onChange={handleToggleCheckAddonVersion}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </>
                            )}
                            <p className="text-muted" style={{ fontSize: "14px" }}><strong>Note:</strong> The game might reset your settings if you launch it manually. Try to always launch it via Warperia.</p>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
};

export default ModificationsModal;