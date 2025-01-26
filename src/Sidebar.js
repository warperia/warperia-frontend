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
          <Tippy content="Website" placement="right" className="custom-tooltip">
            <li className="nav-item mb-2 mt-3">
              <NavLink
                to="https://warperia.com"
                className={({ isActive }) => `nav-link text-white text-center ${isActive ? 'active' : ''}`}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="bi bi-globe sidebar-icon" viewBox="0 0 16 16">
                  <path d="M0 8a8 8 0 1 1 16 0A8 8 0 0 1 0 8m7.5-6.923c-.67.204-1.335.82-1.887 1.855A8 8 0 0 0 5.145 4H7.5zM4.09 4a9.3 9.3 0 0 1 .64-1.539 7 7 0 0 1 .597-.933A7.03 7.03 0 0 0 2.255 4zm-.582 3.5c.03-.877.138-1.718.312-2.5H1.674a7 7 0 0 0-.656 2.5zM4.847 5a12.5 12.5 0 0 0-.338 2.5H7.5V5zM8.5 5v2.5h2.99a12.5 12.5 0 0 0-.337-2.5zM4.51 8.5a12.5 12.5 0 0 0 .337 2.5H7.5V8.5zm3.99 0V11h2.653c.187-.765.306-1.608.338-2.5zM5.145 12q.208.58.468 1.068c.552 1.035 1.218 1.65 1.887 1.855V12zm.182 2.472a7 7 0 0 1-.597-.933A9.3 9.3 0 0 1 4.09 12H2.255a7 7 0 0 0 3.072 2.472M3.82 11a13.7 13.7 0 0 1-.312-2.5h-2.49c.062.89.291 1.733.656 2.5zm6.853 3.472A7 7 0 0 0 13.745 12H11.91a9.3 9.3 0 0 1-.64 1.539 7 7 0 0 1-.597.933M8.5 12v2.923c.67-.204 1.335-.82 1.887-1.855q.26-.487.468-1.068zm3.68-1h2.146c.365-.767.594-1.61.656-2.5h-2.49a13.7 13.7 0 0 1-.312 2.5m2.802-3.5a7 7 0 0 0-.656-2.5H12.18c.174.782.282 1.623.312 2.5zM11.27 2.461c.247.464.462.98.64 1.539h1.835a7 7 0 0 0-3.072-2.472c.218.284.418.598.597.933M10.855 4a8 8 0 0 0-.468-1.068C9.835 1.897 9.17 1.282 8.5 1.077V4z" />
                </svg>
              </NavLink>
            </li>
          </Tippy>
          <Tippy content="Discord" placement="right" className="custom-tooltip">
            <li className="nav-item mb-2">
              <NavLink
                to="https://discord.gg/PukXuK4E8w"
                className={({ isActive }) => `nav-link text-white text-center ${isActive ? 'active' : ''}`}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="bi bi-discord sidebar-icon" viewBox="0 0 16 16">
                  <path d="M13.545 2.907a13.2 13.2 0 0 0-3.257-1.011.05.05 0 0 0-.052.025c-.141.25-.297.577-.406.833a12.2 12.2 0 0 0-3.658 0 8 8 0 0 0-.412-.833.05.05 0 0 0-.052-.025c-1.125.194-2.22.534-3.257 1.011a.04.04 0 0 0-.021.018C.356 6.024-.213 9.047.066 12.032q.003.022.021.037a13.3 13.3 0 0 0 3.995 2.02.05.05 0 0 0 .056-.019q.463-.63.818-1.329a.05.05 0 0 0-.01-.059l-.018-.011a9 9 0 0 1-1.248-.595.05.05 0 0 1-.02-.066l.015-.019q.127-.095.248-.195a.05.05 0 0 1 .051-.007c2.619 1.196 5.454 1.196 8.041 0a.05.05 0 0 1 .053.007q.121.1.248.195a.05.05 0 0 1-.004.085 8 8 0 0 1-1.249.594.05.05 0 0 0-.03.03.05.05 0 0 0 .003.041c.24.465.515.909.817 1.329a.05.05 0 0 0 .056.019 13.2 13.2 0 0 0 4.001-2.02.05.05 0 0 0 .021-.037c.334-3.451-.559-6.449-2.366-9.106a.03.03 0 0 0-.02-.019m-8.198 7.307c-.789 0-1.438-.724-1.438-1.612s.637-1.613 1.438-1.613c.807 0 1.45.73 1.438 1.613 0 .888-.637 1.612-1.438 1.612m5.316 0c-.788 0-1.438-.724-1.438-1.612s.637-1.613 1.438-1.613c.807 0 1.451.73 1.438 1.613 0 .888-.631 1.612-1.438 1.612" />
                </svg>
              </NavLink>
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