import React, { useState, useEffect, useCallback } from "react";
import axios from "axios";
import "bootstrap/dist/css/bootstrap.min.css";
import "bootstrap-icons/font/bootstrap-icons.css";
import Sidebar from "./Sidebar.js";
import Settings from "./Settings.js";
import { WEB_URL } from './config.js';

const UserSettings = ({ user, onLogout, setPage, hasDirectoryIssues }) => {
  const [avatarUrl, setAvatarUrl] = useState('public/no-avatar.jpg');
  const [displayName, setDisplayName] = useState(user.username);
  const [message, setMessage] = useState('');
  const [showToast, setShowToast] = useState(false);
  const [toastType, setToastType] = useState('success');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchUserDetails = async () => {
      setLoading(true); // Set loading to true before API call
      try {
        const tokenResult = await window.electron.retrieveToken();
        if (tokenResult.success && tokenResult.token) {
          const response = await axios.get(`${WEB_URL}/wp-json/wp/v2/users/${user.id}`, {
            headers: {
              'Authorization': `Bearer ${tokenResult.token}`
            }
          });
  
          // Log the response data to see the structure of meta
          // console.log('API Response:', response.data);
  
          if (response.data) {
            // Accessing custom meta fields correctly based on the response structure
            if (response.data.meta) {
              const avatar = response.data.meta.avatar;
              if (avatar) {
                const avatarUrl = Array.isArray(avatar) ? avatar[0] : avatar;
                setAvatarUrl(avatarUrl || 'public/no-avatar.jpg');
              } else {
                setAvatarUrl('public/no-avatar.jpg');
              }
  
              setDisplayName(response.data.display_name || user.username);
            }
          } else {
            showToastMessage("Failed to retrieve user details.", 'danger');
          }
        } else {
          showToastMessage("Failed to retrieve token.", 'danger');
        }
      } catch (error) {
        console.error("Error fetching user details:", error);
        showToastMessage("Error fetching user details.", 'danger');
      } finally {
        setLoading(false); // Set loading to false after API call
      }
    };
  
    fetchUserDetails();
  }, [user.id, user.username]);  

  const handleLogout = useCallback(async () => {
    await window.electron.clearToken();
    await window.electron.clearUser();
    onLogout();
  }, [onLogout]);

  const handleAvatarChange = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const allowedTypes = ['image/jpeg', 'image/png'];
    const maxSize = 2 * 1024 * 1024; // 2MB

    if (!allowedTypes.includes(file.type)) {
      showToastMessage("Only JPG, JPEG, and PNG files are allowed.", 'danger');
      return;
    }

    if (file.size > maxSize) {
      showToastMessage("File size should not exceed 2MB.", 'danger');
      return;
    }

    const formData = new FormData();
    formData.append('file', file);

    try {
      const tokenResult = await window.electron.retrieveToken();
      if (tokenResult.success && tokenResult.token) {
        const response = await axios.post(`${WEB_URL}/wp-json/wp/v2/users/avatar`, formData, {
          headers: {
            'Content-Type': 'multipart/form-data',
            'Authorization': `Bearer ${tokenResult.token}`
          }
        });

        console.log('Upload Response:', response.data);

        if (response.data && response.data.avatar_url) {
          setAvatarUrl(response.data.avatar_url);
          showToastMessage("Avatar updated successfully.", 'success');
        } else {
          showToastMessage("Failed to update avatar.", 'danger');
        }
      } else {
        showToastMessage("Failed to retrieve token.", 'danger');
      }
    } catch (error) {
      showToastMessage("Failed to upload avatar.", 'danger');
      console.error("Error uploading avatar:", error);
    }
  };

  const showToastMessage = useCallback((message, type) => {
    setMessage(message);
    setToastType(type);
    setShowToast(true);
    setTimeout(() => setShowToast(false), 5000);
  }, []);

  return (
    <div className="d-flex">
      <Sidebar setPage={setPage} hasDirectoryIssues={hasDirectoryIssues} />
      <div className="content user-settings flex-grow-1">
        {loading ? (
          <div className="d-flex justify-content-center align-items-center vh-100">
            <div className="spinner-border" role="status">
              <span className="visually-hidden">Loading...</span>
            </div>
            {/* <div className="ms-2">Please wait...</div> */}
          </div>
        ) : (
          <div className="container">
            <div className="top-part d-flex justify-content-between align-items-center">
              <div className="d-flex align-items-center gap-3">
                <div className="avatar position-relative">
                  <img
                    className="img-fluid rounded-circle"
                    src={avatarUrl || 'public/no-avatar.jpg'}
                    alt="Avatar"
                    onClick={() => document.getElementById('avatarInput').click()}
                    draggable="false"
                  />
                  <div className="edit-icon position-absolute"><i className="bi bi-upload fs-2"></i></div>
                  <input
                    type="file"
                    id="avatarInput"
                    style={{ display: 'none' }}
                    accept=".jpg, .jpeg, .png"
                    onChange={handleAvatarChange}
                  />
                </div>
                <div className="d-flex flex-column">
                  <div className="username">{displayName}</div>
                  <div className="email">{user.email}</div>
                </div>
              </div>
              <div className="profile-actions">
                <button className="btn btn-secondary" onClick={handleLogout}>
                  Logout
                </button>
              </div>
            </div>
  
            <div className="center-part mt-5">
              <ul className="nav nav-tabs" id="userTab" role="tablist">
                <li className="nav-item" role="presentation">
                  {/* <button
                    className="nav-link active"
                    id="game-directories-tab"
                    data-bs-toggle="tab"
                    data-bs-target="#game-directories"
                    type="button"
                    role="tab"
                    aria-controls="game-directories"
                    aria-selected="true"
                  >
                    Game Directories
                  </button> */}
                </li>
                <li className="nav-item" role="presentation">
                  <button
                    className="nav-link active"
                    id="settings-tab"
                    data-bs-toggle="tab"
                    data-bs-target="#settings"
                    type="button"
                    role="tab"
                    aria-controls="settings"
                    aria-selected="false"
                  >
                    Settings
                  </button>
                </li>
              </ul>
              <div className="tab-content" id="userTabContent">
                {/* <div
                  className="tab-pane fade show active"
                  id="game-directories"
                  role="tabpanel"
                  aria-labelledby="game-directories-tab"
                >
                  <GameDirectories user={user} showToast={showToastMessage} />
                </div> */}
                <div
                  className="tab-pane fade show active"
                  id="settings"
                  role="tabpanel"
                  aria-labelledby="settings-tab"
                >
                  <Settings user={user} showToast={showToastMessage} />
                </div>
              </div>
            </div>
          </div>
        )}
  
        <div
          className="toast-container position-fixed bottom-0 end-0 p-3"
          style={{ zIndex: 11 }}
        >
          <div
            className={`toast ${showToast ? 'show' : ''}`}
            role="alert"
            aria-live="assertive"
            aria-atomic="true"
          >
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
            <div className="toast-body">{message}</div>
          </div>
        </div>
      </div>
    </div>
  );  
};

export default UserSettings;