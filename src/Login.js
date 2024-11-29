import React, { useState, useEffect } from "react";
import axios from "axios";
import { NavLink, useLocation } from "react-router-dom";
import "bootstrap/dist/css/bootstrap.min.css";
import 'bootstrap-icons/font/bootstrap-icons.css';
import { WEB_URL } from './config.js';

const Login = ({ onLogin }) => {
  const [usernameOrEmail, setUsernameOrEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [settings, setSettings] = useState(null);
  const location = useLocation();

  useEffect(() => {
    // Check if there's a state message from the registration page
    if (location.state?.message) {
      setMessage(location.state.message);
    }

    // Attempt to auto-login if a token is present
    const autoLogin = async () => {
      const result = await window.electron.retrieveToken();
      if (result.success && result.token) {
        onLogin(result.token);
      }
    };

    autoLogin();
  }, [location, onLogin]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setMessage("");  // Clear any previous messages

    try {
      const response = await axios.post(
        `${WEB_URL}/wp-json/wp/v2/users/login`,
        {
          username: usernameOrEmail,
          password: password,
        }
      );

      if (response.data.token) {
        await window.electron.storeToken(response.data.token);
        await window.electron.storeUser(response.data.user); // Store user data securely
        onLogin(response.data.user);
      } else {
        setMessage("Login failed. Please check your credentials.");
      }
    } catch (error) {
      // Handle errors
      if (error.response) {
        if (error.response.status === 401) {
          setMessage("Invalid username or password. Please try again.");
        } else if (error.response.status === 400) {
          setMessage("Bad request. Please check the input.");
        } else {
          setMessage("An unexpected error occurred. Please try again.");
        }
      } else {
        setMessage("Network error. Please check your connection.");
      }
      console.error("Error logging in:", error);
    } finally {
      setIsLoading(false);
    }
  };


  return (
    <div className="container h-100">
      <div className="row h-100 justify-content-center align-items-center">
        <div className="auth-container w-100 mx-auto">
          <div className="text-center mb-4">
          {settings && settings.app_sidebar_logo ? (
          <img
            src={settings.app_sidebar_logo}
            alt="Sidebar Logo"
            className="img-fluid logo"
            draggable="false"
          />
        ) : (
          // Fallback image if the API hasn't loaded or logo is missing
          <img
            src="public/shield-logo.png"
            alt="Default Sidebar Logo"
            className="img-fluid logo"
            draggable="false"
          />
        )}
          </div>
          {message && (
            <div className={`alert ${location.state?.message ? 'alert-success' : 'alert-danger'} d-flex align-items-center`}>
              {message}
            </div>
          )}
          <form onSubmit={handleLogin}>
            <div className="form-group mb-2">
              <input
                type="text"
                className="form-control py-2"
                id="usernameOrEmail"
                value={usernameOrEmail}
                placeholder="Username or Email"
                onChange={(e) => setUsernameOrEmail(e.target.value)}
                required
              />
            </div>
            <div className="form-group mb-3">
              <input
                type="password"
                className="form-control py-2"
                id="password"
                value={password}
                placeholder="Password"
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <div className="d-flex align-items-center justify-content-between">
              <button type="submit" className="btn btn-primary" disabled={isLoading}>
                {isLoading ? "Loading..." : "Login"}
              </button>
              <NavLink to="/register">
                <button type="button" className="btn btn-link">
                  Register
                </button>
              </NavLink>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Login;