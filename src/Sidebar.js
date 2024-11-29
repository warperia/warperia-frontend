import React, { useState, useEffect, Suspense, lazy } from "react";
import "bootstrap/dist/css/bootstrap.min.css";
import "bootstrap-icons/font/bootstrap-icons.css";
import { NavLink } from "react-router-dom";
import Tippy from '@tippyjs/react';
import 'tippy.js/dist/tippy.css';
import { WEB_URL } from './config.js';

import { ReactSVG } from 'react-svg';

const AddServerModal = lazy(() => import('./components/modals/AddServerModal.js'));

const Sidebar = () => {
  const [updateUrl, setUpdateUrl] = useState("");
  const [appVersion, setAppVersion] = useState("");
  const [latestVersion, setLatestVersion] = useState("");
  const [userServers, setUserServers] = useState([]);
  const [settings, setSettings] = useState(null);
  const [showAddServerModal, setShowAddServerModal] = useState(false);
  const [user, setUser] = useState(null);

  // Fetch user servers
  const fetchUserServers = async () => {
    try {
      if (!user || !user.id) {
        console.warn("User is not defined or missing 'id'. Skipping fetchUserServers.");
        return;
      }

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
        // Ensure servers is an array
        if (!Array.isArray(servers)) {
          servers = Object.values(servers);
        }

        setUserServers(servers);
      }
    } catch (error) {
      console.error('Error fetching user servers:', error);
    }
  };


  useEffect(() => {
    const fetchUserInfo = async () => {
      const userResult = await window.electron.retrieveUser();
      if (userResult.success && userResult.user) {
        const tokenResult = await window.electron.retrieveToken();
        if (tokenResult.success && tokenResult.token) {
          const response = await fetch(`${WEB_URL}/wp-json/wp/v2/users/${userResult.user.id}`, {
            headers: {
              Authorization: `Bearer ${tokenResult.token}`,
            },
          });
          const data = await response.json();
          setUser({
            ...userResult.user,
            meta: data.meta,
          });
        }
      }
    };

    fetchUserInfo();
  }, []);

  useEffect(() => {
    if (user) {
      fetchUserServers();
    }
  }, [user]);

  useEffect(() => {
    const fetchAppVersion = window.electron.ipcRenderer.invoke("get-app-version");
    const fetchSettings = fetch(`${WEB_URL}/wp-json/wp/v2/site-settings`).then((res) => res.json());

    Promise.all([fetchAppVersion, fetchSettings])
      .then(([versionResult, settingsData]) => {
        setAppVersion(versionResult.version);
        setLatestVersion(settingsData.app_version);
        setUpdateUrl(settingsData.app_file);
      })
      .catch((error) => {
        console.error("Error fetching data:", error);
      });
  }, []);

  return (
    <><div className="sidenav d-flex flex-column py-3 text-white">
      <div className="logo mt-3 mb-5 text-center">
        {settings && settings.app_sidebar_logo ? (
          <img
            src={settings.app_sidebar_logo}
            alt="Sidebar Logo"
            className="img-fluid"
            draggable="false" />
        ) : (
          <img
            src="public/icon-shield.png"
            alt="Default Sidebar Logo"
            className="img-fluid"
            draggable="false" />
        )}
      </div>
      <ul className="nav nav-pills flex-column mb-auto">
        <Tippy content="Home" placement="right" className="custom-tooltip">
          <li className="nav-item mb-2">
            <NavLink
              to="/home"
              className={({ isActive }) => `nav-link text-white text-center ${isActive ? 'active' : ''}`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="bi bi-house sidebar-icon" viewBox="0 0 16 16">
                <path d="M8.707 1.5a1 1 0 0 0-1.414 0L.646 8.146a.5.5 0 0 0 .708.708L2 8.207V13.5A1.5 1.5 0 0 0 3.5 15h9a1.5 1.5 0 0 0 1.5-1.5V8.207l.646.647a.5.5 0 0 0 .708-.708L13 5.793V2.5a.5.5 0 0 0-.5-.5h-1a.5.5 0 0 0-.5.5v1.293zM13 7.207V13.5a.5.5 0 0 1-.5.5h-9a.5.5 0 0 1-.5-.5V7.207l5-5z" />
              </svg>
            </NavLink>
          </li>
        </Tippy>
        <Tippy content="Servers" placement="right" className="custom-tooltip">
          <li className="nav-item mb-2">
            <NavLink
              to="/servers"
              className={({ isActive }) => `nav-link text-white text-center ${isActive ? 'active' : ''}`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="bi bi-collection sidebar-icon" viewBox="0 0 16 16">
                <path d="M2.5 3.5a.5.5 0 0 1 0-1h11a.5.5 0 0 1 0 1zm2-2a.5.5 0 0 1 0-1h7a.5.5 0 0 1 0 1zM0 13a1.5 1.5 0 0 0 1.5 1.5h13A1.5 1.5 0 0 0 16 13V6a1.5 1.5 0 0 0-1.5-1.5h-13A1.5 1.5 0 0 0 0 6zm1.5.5A.5.5 0 0 1 1 13V6a.5.5 0 0 1 .5-.5h13a.5.5 0 0 1 .5.5v7a.5.5 0 0 1-.5.5z" />
              </svg>
            </NavLink>
          </li>
        </Tippy>
      </ul>
      <div className="sidenav-bottom w-100 mb-3">
        <ul className="nav nav-pills flex-column mb-auto">
          <Tippy content="Create Server" placement="right" className="custom-tooltip">
            <li className="nav-item">
              <div
                className="nav-link nav-create-btn text-white text-center"
                onClick={() => setShowAddServerModal(true)}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="bi bi-plus sidebar-icon"
                  viewBox="0 0 16 16"
                >
                  <path d="M8 2a.5.5 0 0 1 .5.5v5h5a.5.5 0 0 1 0 1h-5v5a.5.5 0 0 1-1 0v-5h-5a.5.5 0 0 1 0-1h5v-5A.5.5 0 0 1 8 2" />
                </svg>
              </div>
            </li>
          </Tippy>
          <Tippy content="Settings" placement="right" className="custom-tooltip">
            <li className="nav-item">
              <NavLink
                to="/settings"
                className={({ isActive }) => `nav-link text-white text-center ${isActive ? 'active' : ''}`}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="bi bi-gear-wide sidebar-icon" viewBox="0 0 16 16">
                  <path d="M8.932.727c-.243-.97-1.62-.97-1.864 0l-.071.286a.96.96 0 0 1-1.622.434l-.205-.211c-.695-.719-1.888-.03-1.613.931l.08.284a.96.96 0 0 1-1.186 1.187l-.284-.081c-.96-.275-1.65.918-.931 1.613l.211.205a.96.96 0 0 1-.434 1.622l-.286.071c-.97.243-.97 1.62 0 1.864l.286.071a.96.96 0 0 1 .434 1.622l-.211.205c-.719.695-.03 1.888.931 1.613l.284-.08a.96.96 0 0 1 1.187 1.187l-.081.283c-.275.96.918 1.65 1.613.931l.205-.211a.96.96 0 0 1 1.622.434l.071.286c.243.97 1.62.97 1.864 0l.071-.286a.96.96 0 0 1 1.622-.434l.205.211c.695.719 1.888.03 1.613-.931l-.08-.284a.96.96 0 0 1 1.187-1.187l.283.081c.96.275 1.65-.918.931-1.613l-.211-.205a.96.96 0 0 1 .434-1.622l.286-.071c.97-.243.97-1.62 0-1.864l-.286-.071a.96.96 0 0 1-.434-1.622l.211-.205c.719-.695.03-1.888-.931-1.613l-.284.08a.96.96 0 0 1-1.187-1.186l.081-.284c.275-.96-.918-1.65-1.613-.931l-.205.211a.96.96 0 0 1-1.622-.434zM8 12.997a4.998 4.998 0 1 1 0-9.995 4.998 4.998 0 0 1 0 9.996z" />
                </svg>
              </NavLink>
            </li>
          </Tippy>
        </ul>
      </div>
    </div>
      {showAddServerModal && (
        <Suspense fallback={<div className="text-center my-4"><div className="spinner-border" role="status"><span className="visually-hidden">Loading...</span></div></div>}>
          <AddServerModal
            show={showAddServerModal}
            onClose={() => setShowAddServerModal(false)}
            user={user}
            refreshServers={fetchUserServers}
          />
        </Suspense>
      )}
    </>
  );
};

export default Sidebar;