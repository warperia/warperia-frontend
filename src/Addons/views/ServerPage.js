import React, { useEffect, useState, Suspense, lazy } from 'react';
import { useParams } from 'react-router-dom';
import Sidebar from "./../../Sidebar.js";
import Tippy from '@tippyjs/react';
import 'tippy.js/dist/tippy.css';
import { WEB_URL } from '../../config.js';

const AddonsPage = lazy(() => import('./AddonsPage.js'));
const EditServerModal = lazy(() => import('./../../components/modals/EditServerModal.js'));

const knownLocales = [
    "enUS", "enGB", "deDE", "frFR", "esES", "ruRU", "zhCN", "zhTW", "koKR",
];

const ServerPage = ({ user }) => {
    const { serverId } = useParams();
    const [server, setServer] = useState(null);
    const [serverRealmlist, setServerRealmlist] = useState("");
    const [activeTab, setActiveTab] = useState('myAddons');
    const [isRunning, setIsRunning] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [serverNotFound, setServerNotFound] = useState(false);
    const [fetchTrigger, setFetchTrigger] = useState(0);

    const expansion = server?.s_version || 'Unknown Expansion';

    const handleEditServer = () => setShowEditModal(true);

    // Extracted fetch logic into its own function
    const fetchServerData = async () => {
        try {
            const tokenResult = await window.electron.retrieveToken();
            if (tokenResult.success && tokenResult.token) {
                const response = await fetch(
                    `${WEB_URL}/wp-json/wp/v2/users/${user.id}`,
                    {
                        headers: {
                            Authorization: `Bearer ${tokenResult.token}`,
                        },
                    }
                );

                const data = await response.json();
                let servers = data.meta.user_servers || [];

                if (typeof servers === 'string') {
                    servers = JSON.parse(servers);
                } else if (!Array.isArray(servers)) {
                    servers = Object.values(servers);
                }

                const matchedServer = servers.find((s, index) => {
                    const id = s.id || index.toString();
                    return id === serverId;
                });

                if (matchedServer) {
                    setServer(matchedServer);
                } else {
                    console.warn('Server not found for the given ID.');
                    setServerNotFound(true);
                }
            }
        } catch (error) {
            console.error('Error fetching server data:', error);
            setServerNotFound(true);
        }
    };

    // Refresh data
    useEffect(() => {
        if (user && user.id) {
            setServer(null);
            setServerNotFound(false);
            fetchServerData();
        }
    }, [user, serverId, fetchTrigger]);

    useEffect(() => {
        const handleProcessStatusUpdate = ({ exePath, running }) => {
            if (server?.s_path === exePath) {
                setIsRunning(running);
            }
        };

        window.electron.ipcRenderer.on('process-status-update', handleProcessStatusUpdate);

        return () => {
            window.electron.ipcRenderer.removeListener('process-status-update', handleProcessStatusUpdate);
        };
    }, [server]);

    const handleLaunch = async () => {
        if (!server?.s_path) return;
        try {
            await window.electron.launchExe(server.s_path);
        } catch (error) {
            console.error('Error launching executable:', error);
        }
    };

    const handleRestart = async () => {
        if (!server?.s_path) return;
        try {
            await window.electron.terminateProcess(server.s_path);
            await window.electron.launchExe(server.s_path);
        } catch (error) {
            console.error('Error restarting executable:', error);
        }
    };

    const handleOpenDirectory = (directoryPath) => {
        if (!directoryPath) {
            return;
        }

        try {
            const normalizedPath = window.electron.pathNormalize(directoryPath);
            window.electron.ipcRenderer.invoke("open-directory", normalizedPath);
        } catch (error) {
            // console.error("Failed to open directory:", error);
        }
    };

    // Detect realmlist after server data is fetched and we have s_path and s_version
    useEffect(() => {
        const detectRealmlist = async () => {
            if (!server?.s_path || !server?.s_version) return;

            const gameVersion = server.s_version;
            const dirPath = server.s_dir;
            if (!dirPath || !gameVersion) return;

            // Determine if Mists of Pandaria expansion
            const isMop = (gameVersion.toLowerCase() === 'mop');
            const dataDir = await window.electron.pathJoin(dirPath, "Data");

            try {
                const directories = await window.electron.readDir(dataDir);
                const locale = directories.find((d) => knownLocales.includes(d));
                if (!locale) return; // No locale found

                const realmlistFilePath = await window.electron.pathJoin(dataDir, locale, "realmlist.wtf");
                const realmlistExists = await window.electron.fileExists(realmlistFilePath);
                let realmlistValue = "";

                if (realmlistExists) {
                    const realmlistContent = await window.electron.readFile(realmlistFilePath);
                    realmlistValue = parseRealmlistFromContent(realmlistContent, false);
                }

                let configRealmlistValue = "";
                if (isMop) {
                    const configPath = await window.electron.pathJoin(dirPath, "WTF", "Config.wtf");
                    const configExists = await window.electron.fileExists(configPath);
                    if (configExists) {
                        const configContent = await window.electron.readFile(configPath);
                        configRealmlistValue = parseRealmlistFromContent(configContent, true);
                    }
                }

                const finalRealmlist = realmlistValue || configRealmlistValue || "";
                setServerRealmlist(finalRealmlist);
            } catch (err) {
                console.error("Error detecting realmlist on ServerPage:", err);
            }
        };

        detectRealmlist();
    }, [server]);

    const parseRealmlistFromContent = (content, isMop) => {
        let lines = content.split("\n").map((l) => l.trim());
        let match = null;
        if (isMop) {
            match = lines.find((l) => l.toLowerCase().startsWith("set realmlist "));
            if (!match) {
                match = lines.find((l) => l.toUpperCase().startsWith("SET REALMLIST "));
            }
            if (match) {
                const regex = /SET\s+realmlist\s+"([^"]+)"/i;
                const found = match.match(regex);
                return found ? found[1] : "";
            }
        } else {
            match = lines.find((l) => l.toLowerCase().startsWith("set realmlist"));
            if (match) {
                const parts = match.split(/\s+/);
                if (parts.length > 2) {
                    return parts.slice(2).join(" ");
                }
            }
        }
        return "";
    };

    if (serverNotFound) {
        return (
            <div className="d-flex">
                <Sidebar setPage={() => { }} />
                <div className="content page-addons flex-grow-1">
                    <div className="container">
                        <div className="my-4">
                            <h3 className="text-danger">Server Not Found</h3>
                            <p>The server you're trying to access does not exist or has been removed.</p>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    if (!server) {
        return (
            <div className="content page-addons flex-grow-1">
                <div className="text-center my-4">
                    <div className="spinner-border" role="status">
                        <span className="visually-hidden">Loading...</span>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="d-flex">
            <Sidebar setPage={() => { }} />
            <div className="content page-addons flex-grow-1">
                <div className="container-fluid server-page">
                    <div className="row">
                        <div className="col-12 col-lg-3 left">
                            <div className="server-info card mb-4 sticky-top">
                                <div className="card-body d-flex flex-column gap-3">
                                    <div className="d-flex align-items-center flex-wrap gap-2">
                                        <img
                                            src={server.s_image || 'public/default-image.jpg'}
                                            alt={server.s_name}
                                            className="img-fluid rounded me-3"
                                            style={{ width: '100px', height: '100px', objectFit: 'cover' }}
                                        />
                                        <div>
                                            <h3 className="card-title text-white fw-bold h4">{server.s_name || 'Unnamed Server'}</h3>
                                            <p className="card-text fw-medium text-muted mb-0"><strong>Expansion:</strong> <span className="text-uppercase">{expansion}</span></p>
                                            {serverRealmlist && (
                                                <p className="card-text fw-medium text-muted">
                                                    <strong>Realmlist:</strong> <span>{serverRealmlist}</span>
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                    <div className="d-flex align-items-center flex-wrap gap-2">
                                        <button
                                            className="btn btn-primary"
                                            onClick={handleLaunch}
                                            disabled={isRunning}
                                        >
                                            <i className="bi bi-play-fill"></i> {isRunning ? 'Running' : 'Launch'}
                                        </button>
                                        <button
                                            className="btn btn-secondary btn-restart"
                                            onClick={handleRestart}
                                            disabled={!isRunning}
                                        >
                                            <i className="bi bi-arrow-clockwise"></i> Restart
                                        </button>
                                        <Tippy content="Open server directory" placement="top" className="custom-tooltip">
                                            <button
                                                className="ms-auto btn btn-link"
                                                onClick={() => handleOpenDirectory(server.s_dir)}
                                            >
                                                <i className="bi bi-folder-symlink vertical-fix"></i>
                                            </button>
                                        </Tippy>
                                    </div>
                                    <div className="mt-3">
                                        <ul className="nav nav-pills flex-column">
                                            <li className="nav-item mb-1">
                                                <button
                                                    className={`d-flex align-items-center nav-link ${activeTab === 'myAddons' ? 'active' : ''}`}
                                                    onClick={() => setActiveTab('myAddons')}
                                                >
                                                    <i className="bi bi-box me-2"></i> <span>Installed Addons</span>
                                                </button>
                                            </li>
                                            <li className="nav-item mb-1">
                                                <button
                                                    className={`nav-link ${activeTab === 'browseAddons' ? 'active' : ''}`}
                                                    onClick={() => setActiveTab('browseAddons')}
                                                >
                                                    <i className="bi bi-search me-2"></i> <span>Browse Addons</span>
                                                </button>
                                            </li>
                                            <li className="nav-item">
                                                <button
                                                    className="nav-link"
                                                    onClick={handleEditServer}
                                                >
                                                    <i className="bi bi-gear me-2"></i> <span>Edit Server</span>
                                                </button>
                                            </li>
                                        </ul>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="col-12 col-lg-9 right">
                            <AddonsPage
                                user={user}
                                activeTab={activeTab}
                                setActiveTab={setActiveTab}
                                gameVersion={expansion}
                                serverPath={server.s_path}
                                gamePath={server.s_dir}
                                currentExpansion={expansion.toLowerCase()}
                            />
                        </div>
                    </div>
                </div>
            </div>
            {showEditModal && (
                <Suspense fallback={<div className="text-center my-4"><div className="spinner-border" role="status"><span className="visually-hidden">Loading...</span></div></div>}>
                    <EditServerModal
                        show={showEditModal}
                        onClose={() => setShowEditModal(false)}
                        user={user}
                        server={server}
                        refreshServers={() => {
                            setShowEditModal(false);
                            setFetchTrigger(prev => prev + 1);
                        }}
                    />
                </Suspense>
            )}
        </div>
    );
};

export default ServerPage;