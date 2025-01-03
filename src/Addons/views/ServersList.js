import React, { useState, useEffect, Suspense, lazy } from 'react';
import { useNavigate } from 'react-router-dom';
import { WEB_URL } from './../../config.js';
import Sidebar from "./../../Sidebar.js";
import Tippy from '@tippyjs/react';
import 'tippy.js/dist/tippy.css';

const AddServerModal = lazy(() => import('./../../components/modals/AddServerModal.js'));
const EditServerModal = lazy(() => import('./../../components/modals/EditServerModal.js'));

const ServersList = ({ user }) => {
    const [servers, setServers] = useState([]);
    const [selectedServer, setSelectedServer] = useState(null);
    const [showAddServerModal, setShowAddServerModal] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const navigate = useNavigate();

    // Fetch user's servers
    const fetchServers = async () => {
        try {
            if (!user || !user.id) return;

            const tokenResult = await window.electron.retrieveToken();
            if (tokenResult.success && tokenResult.token) {
                const response = await fetch(`${WEB_URL}/wp-json/wp/v2/users/${user.id}`, {
                    headers: {
                        Authorization: `Bearer ${tokenResult.token}`,
                    },
                });
                const data = await response.json();
                let serversList = data.meta.user_servers || [];

                // Ensure servers is an array
                if (typeof serversList === 'string') {
                    serversList = JSON.parse(serversList);
                } else if (!Array.isArray(serversList)) {
                    serversList = Object.values(serversList);
                }

                setServers(serversList);
            }
        } catch (error) {
            console.error('Error fetching servers:', error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        if (user) {
            fetchServers();
        }
    }, [user]);

    const handleEditServer = (server) => {
        setSelectedServer(server);
        setShowEditModal(true);
    };

    const handleNavigateToServerPage = (index) => {
        navigate(`/server/${index}`);
    };

    return (
        <div className="d-flex">
            <Sidebar setPage={() => { }} />
            <div className="content page-servers flex-grow-1">
                <div className="container my-4">
                    <div className="d-flex align-items-center justify-content-between flex-wrap gap-1 mb-4">
                        <div className="page-heading">
                            <h2 className="text-white fw-bold">Servers</h2>
                            <p className="text-muted fw-medium mb-0">Browse your World of Warcraft private server installations</p>
                        </div>
                        <div>
                            <Tippy content="Refresh list" placement="auto" className="custom-tooltip">
                                <button
                                    className="btn btn-secondary fw-bold me-2"
                                    onClick={() => {
                                        setIsLoading(true);
                                        fetchServers();
                                    }}
                                >
                                    <i className="bi bi-arrow-clockwise"></i>
                                </button>
                            </Tippy>
                            <button
                                className="btn btn-secondary"
                                onClick={() => setShowAddServerModal(true)}
                            >
                                <i className="bi bi-plus-lg"></i> Add Server
                            </button>
                        </div>
                    </div>

                    {isLoading ? (
                        <div className="text-center my-5">
                            <div className="spinner-border text-primary" role="status">
                                <span className="visually-hidden">Loading...</span>
                            </div>
                        </div>
                    ) : servers.length === 0 ? (
                        <div className="my-4">
                            <p className="text-muted fw-medium">Your servers list is currently empty.</p>
                        </div>
                    ) : (
                        <div className="row g-3">
                            {servers.map((server, index) => (
                                <div
                                    key={index}
                                    className="col-12 col-lg-6 align-items-stretch"
                                    onClick={() => handleNavigateToServerPage(index)}
                                >
                                    <div className="server-card d-flex align-items-center">
                                        <div className="server-card-logo position-relative d-flex align-items-center justify-content-center">
                                            <img
                                                src={server.s_image || 'public/default-image.jpg'}
                                                alt={server.s_name || 'Server'}
                                                className="img-fluid"
                                                loading="lazy"
                                                draggable="false"
                                            />
                                            <div className="icon position-absolute">
                                                <i className="bi bi-play-circle-fill fs-1"></i>
                                            </div>
                                        </div>
                                        <div className="server-card-content d-flex justify-content-between align-items-center w-100">
                                            <div className="left">
                                                <div className="card-title">{server.s_name || 'Unnamed Server'}</div>
                                                <p className="card-text fw-medium text-muted">
                                                    {server.s_version ? server.s_version.toUpperCase() : 'Unknown'}
                                                </p>
                                            </div>
                                            <div className="right server-card-actions">
                                                <button
                                                    className="btn btn-danger"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleEditServer(server);
                                                    }}
                                                >
                                                    <i className="bi bi-gear-wide"></i>
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
            {showAddServerModal && (
                <Suspense fallback={<div className="text-center my-4"><div className="spinner-border" role="status"><span className="visually-hidden">Loading...</span></div></div>}>
                    <AddServerModal
                        show={showAddServerModal}
                        onClose={() => setShowAddServerModal(false)}
                        user={user}
                        refreshServers={fetchServers}
                    />
                </Suspense>
            )}
            {showEditModal && selectedServer && (
                <Suspense
                    fallback={
                        <div className="text-center my-4">
                            <div className="spinner-border" role="status">
                                <span className="visually-hidden">Loading...</span>
                            </div>
                        </div>
                    }
                >
                    <EditServerModal
                        show={showEditModal}
                        onClose={() => setShowEditModal(false)}
                        user={user}
                        server={selectedServer}
                        refreshServers={fetchServers}
                    />
                </Suspense>
            )}
        </div>
    );
};

export default ServersList;