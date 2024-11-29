import React, { useState, useEffect } from "react";
import axios from "axios";
import "bootstrap/dist/css/bootstrap.min.css";
import { WEB_URL } from './config.js';

const Settings = ({ user, showToast }) => {
  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  useEffect(() => {
    const fetchUserDetails = async () => {
      try {
        const tokenResult = await window.electron.retrieveToken();
        if (tokenResult.success && tokenResult.token) {
          const response = await axios.get(
            `${WEB_URL}/wp-json/wp/v2/users/${user.id}`,
            {
              headers: {
                Authorization: `Bearer ${tokenResult.token}`,
              },
            }
          );

          if (response.data) {
            setDisplayName(response.data.display_name || "");
            setUsername(response.data.username || "");
            setEmail(response.data.email || "");
          }
        } else {
          showToast("Failed to retrieve token.", "danger");
        }
      } catch (error) {
        console.error("Error fetching user details:", error);
        showToast("Error fetching user details.", "danger");
      }
    };

    fetchUserDetails();
  }, [user.id, showToast]);

  const handleDisplayNameChange = async () => {
    if (!displayName.trim()) {
      showToast("Display name cannot be empty.", "danger");
      return;
    }

    try {
      const tokenResult = await window.electron.retrieveToken();
      if (tokenResult.success && tokenResult.token) {
        const response = await axios.post(
          `${WEB_URL}/wp-json/wp/v2/users/update-display-name`,
          {
            display_name: displayName.trim(),
          },
          {
            headers: {
              Authorization: `Bearer ${tokenResult.token}`,
            },
          }
        );

        if (response.data && response.data.message) {
          showToast(response.data.message, "success");
        }
      } else {
        showToast("Failed to retrieve token.", "danger");
      }
    } catch (error) {
      showToast("Failed to update display name.", "danger");
      console.error("Error updating display name:", error);
    }
  };

  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      showToast("All password fields are required.", "danger");
      return;
    }

    if (newPassword !== confirmPassword) {
      showToast("New passwords do not match.", "danger");
      return;
    }

    if (newPassword.length < 6) {
      showToast("Password must be at least 6 characters long.", "danger");
      return;
    }

    try {
      const tokenResult = await window.electron.retrieveToken();
      if (tokenResult.success && tokenResult.token) {
        const response = await axios.post(
          `${WEB_URL}/wp-json/wp/v2/users/change-password`,
          {
            current_password: currentPassword,
            new_password: newPassword,
            confirm_password: confirmPassword,
          },
          {
            headers: {
              Authorization: `Bearer ${tokenResult.token}`,
            },
          }
        );

        if (response.data && response.data.message) {
          showToast(response.data.message, "success");
          setCurrentPassword("");
          setNewPassword("");
          setConfirmPassword("");
        }
      } else {
        showToast("Failed to retrieve token.", "danger");
      }
    } catch (error) {
      showToast(
        "Failed to change password. Please double-check your information and try again.",
        "danger"
      );
      console.error("Error changing password:", error);
    }
  };

  return (
    <div className="settings">
      <div className="container-fluid">
        <div className="d-flex flex-column gap-4">
          <div className="settings-acc-details">
            <h5 className="mb-3">Account Details</h5>
            <div className="row row-cols-1 row-cols-md-3">
              <div className="col">
                <div className="fw-medium text-muted mb-1">Display Name</div>
                <input
                  type="text"
                  className="form-control"
                  id="displayName"
                  value={displayName}
                  placeholder="Display Name"
                  onChange={(e) => setDisplayName(e.target.value)}
                />
              </div>
              <div className="col">
              <div className="fw-medium text-muted mb-1">Username</div>
                <input
                  type="text"
                  className="form-control"
                  id="username"
                  value={username}
                  placeholder="Username"
                  readOnly
                />
              </div>
              <div className="col">
              <div className="fw-medium text-muted mb-1">Email Address</div>
                <input
                  type="text"
                  className="form-control"
                  id="email"
                  value={email}
                  placeholder="Email Address"
                  readOnly
                />
              </div>
            </div>
            <button
              className="btn btn-primary mt-3"
              onClick={handleDisplayNameChange}
            >
              Save Changes
            </button>
          </div>
          <hr />
          <div className="settings-acc-password">
            <h5 className="mb-3">Update Password</h5>
            <div className="row row-cols-1 row-cols-md-3">
              <div className="col">
              <div className="fw-medium text-muted mb-1">Current Password</div>
                <input
                  type="password"
                  className="form-control"
                  id="currentPassword"
                  value={currentPassword}
                  placeholder="Current Password"
                  onChange={(e) => setCurrentPassword(e.target.value)}
                />
              </div>
              <div className="col">
              <div className="fw-medium text-muted mb-1">New Password</div>
                <input
                  type="password"
                  className="form-control"
                  id="newPassword"
                  value={newPassword}
                  placeholder="New Password"
                  onChange={(e) => setNewPassword(e.target.value)}
                />
              </div>
              <div className="col">
              <div className="fw-medium text-muted mb-1">Confirm Password</div>
                <input
                  type="password"
                  className="form-control"
                  id="confirmPassword"
                  value={confirmPassword}
                  placeholder="Confirm Password"
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
              </div>
            </div>
            <button
              className="btn btn-primary mt-3"
              onClick={handleChangePassword}
            >
              Change Password
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;