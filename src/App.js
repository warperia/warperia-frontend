import React, { useState, useEffect, useCallback } from "react";
import { HashRouter as Router, Route, Routes, Navigate } from "react-router-dom";
import "bootstrap/dist/css/bootstrap.min.css";
import Registration from "./Registration.js";
import Login from "./Login.js";
import Home from "./Home.js";
import UserSettings from "./UserSettings.js";
import ServersList from "./Addons/views/ServersList.js";
import ServerPage from "./Addons/views/ServerPage.js";
import axios from "axios";
import { WEB_URL } from './config.js';

const App = () => {
  const [user, setUser] = useState(null);
  const [loadingUser, setLoadingUser] = useState(true);
  const [isTokenValid, setIsTokenValid] = useState(true);
  const [toastMessage, setToastMessage] = useState(null);
  const [toastType, setToastType] = useState("light");
  const [currentPage, setCurrentPage] = useState("home");

  // Update state
  const [isUpdating, setIsUpdating] = useState(false);
  const [latestVersion, setLatestVersion] = useState("");
  const [updateUrl, setUpdateUrl] = useState("");
  const [appVersion, setAppVersion] = useState("");

  const setPage = (page) => {
    setCurrentPage(page);
  };

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

  useEffect(() => {
    const initializeUser = async () => {
      try {
        const tokenResult = await window.electron.retrieveToken();
        const userResult = await window.electron.retrieveUser();

        if (tokenResult.success && tokenResult.token && userResult.success && userResult.user) {
          console.log("User and token retrieved successfully:", userResult.user);
          setUser(userResult.user);
        } else {
          console.error("Failed to retrieve user or token.");
          await window.electron.clearToken();
          await window.electron.clearUser();
          setIsTokenValid(false); // Set token as invalid if retrieval fails
        }
      } catch (error) {
        console.error("Error during user initialization:", error);
        setIsTokenValid(false); // Set token as invalid on error
      } finally {
        setLoadingUser(false);
      }
    };
    initializeUser();
  }, []);

  const handleLogin = (user) => {
    setUser(user);
  };

  const handleLogout = async () => {
    setUser(null);
    await window.electron.clearToken();
    await window.electron.clearUser();
  };

  return (
    <Router>
      <div className="h-100">
        {loadingUser ? (
          <div className="text-center my-5">
            <div className="spinner-border" role="status">
              <span className="visually-hidden">Loading user...</span>
            </div>
          </div>
        ) : isUpdating ? (
          // Update Progress UI
          <div className="update-progress d-flex justify-content-center align-items-center vh-100">
            <div className="text-center">
              <div className="d-flex align-items-center gap-3">
                <div className="spinner-border" role="status">
                  <span className="visually-hidden">Loading...</span>
                </div>
                <div className="fs-5">Warperia is being updated</div>
              </div>
              <div className="progress rounded-0 mt-3">
                <div
                  className="progress-bar bg-primary"
                  role="progressbar"
                  style={{ width: `${downloadProgress}%` }}
                  aria-valuenow={downloadProgress}
                  aria-valuemin="0"
                  aria-valuemax="100"
                >
                </div>
              </div>
              <div className="mt-3">({downloadProgress}%)</div>
            </div>
          </div>
        ) : (
          // Main content when the app is not updating
          <Routes>
            <Route
              path="/login"
              element={user ? <Navigate to="/home" /> : <Login onLogin={handleLogin} />}
            />
            <Route
              path="/register"
              element={user ? <Navigate to="/home" /> : <Registration />}
            />
            <Route
              path="/home"
              element={user ? <Home user={user} setPage={setPage} /> : <Navigate to="/login" />}
            />
            <Route
              path="/settings"
              element={user ? <UserSettings user={user} onLogout={handleLogout} /> : <Navigate to="/login" />}
            />
            <Route
              path="/servers"
              element={user ? <ServersList user={user} /> : <Navigate to="/login" />}
            />
            <Route path="/server/:serverId" element={<ServerPage user={user} />} />
            <Route
              path="/"
              element={<Navigate to="/login" />}
            />
            <Route
              path="*"
              element={<div>Page not found</div>}
            />
          </Routes>
        )}
        {toastMessage && (
          <div className="toast-container position-fixed bottom-0 end-0 p-3" style={{ zIndex: 11 }}>
            <div className={`toast show text-bg-${toastType}`} role="alert" aria-live="assertive" aria-atomic="true">
              <div className={`toast-header text-${toastType}`}>
                <strong className="me-auto">
                  <i className="bi bi-bell"></i> Notification
                </strong>
                <button
                  type="button"
                  className="btn-close btn-close-white"
                  data-bs-dismiss="toast"
                  aria-label="Close"
                  onClick={() => setToastMessage(null)}
                ></button>
              </div>
              <div className="toast-body">{toastMessage}</div>
            </div>
          </div>
        )}
        {/* Update Bar */}
        {latestVersion && appVersion && appVersion !== latestVersion && !isUpdating && (
          <div className="update-bar position-fixed bottom-0 start-0 end-0 bg-dark text-white p-3 d-flex justify-content-between align-items-center">
            <span className="fw-bolder">A new update is available for Warperia</span>
            <a
              href={updateUrl || "#"}
              className="btn btn-primary fw-bold"
              target="_blank"
              rel="noopener noreferrer"
            >
              Download Update
            </a>
          </div>
        )}
      </div>
    </Router>
  );
};

export default App;