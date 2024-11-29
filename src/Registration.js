import React, { useState } from "react";
import axios from "axios";
import { NavLink, useNavigate } from "react-router-dom";
import "bootstrap/dist/css/bootstrap.min.css";
import { WEB_URL } from './config.js';

const Registration = () => {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [settings, setSettings] = useState(null);
  const navigate = useNavigate();

  const validatePassword = (password) => {
    // Regular expression to check for at least one letter and one number
    const passwordRegex = /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d@$!%*?&]{6,}$/;
    return passwordRegex.test(password);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validatePassword(password)) {
      setMessage(
        "Password must be at least 6 characters long and include both letters and numbers."
      );
      return;
    }

    if (password !== confirmPassword) {
      setMessage("Passwords do not match!");
      return;
    }

    setIsLoading(true);
    setMessage(""); // Clear any previous messages

    try {
      const response = await axios.post(
        `${WEB_URL}/wp-json/wp/v2/users/register`,
        {
          username,
          email,
          password,
        }
      );

      if (response.status === 201 || response.data.user_id) {
        navigate("/login", {
          state: { message: "Account created successfully. Please log in." },
        });
      } else {
        setMessage("Registration failed. Please try again.");
      }
    } catch (error) {
      if (error.response) {
        if (error.response.status === 400) {
          setMessage("User already exists or invalid data.");
        } else if (error.response.status === 500) {
          setMessage("Server error. Please try again later.");
        } else {
          setMessage("We couldn't complete the registration. Please try again.");
        }
      } else {
        setMessage("Network error. Please check your connection.");
      }
      console.error("Error registering user:", error);
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
          {message && <div className="alert alert-info">{message}</div>}
          <form onSubmit={handleSubmit}>
            <div className="form-group mb-2">
              <input
                type="text"
                className="form-control py-2"
                id="username"
                value={username}
                placeholder="Username"
                onChange={(e) => setUsername(e.target.value)}
                required
              />
            </div>
            <div className="form-group mb-2">
              <input
                type="email"
                className="form-control py-2"
                id="email"
                value={email}
                placeholder="Email Address"
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="form-group mb-2">
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
            <div className="form-group mb-4">
              <input
                type="password"
                className="form-control py-2"
                id="confirmPassword"
                value={confirmPassword}
                placeholder="Confirm Password"
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />
            </div>
            <div className="d-flex align-items-center justify-content-between">
              <button type="submit" className="btn btn-primary" disabled={isLoading}>
                {isLoading ? "Loading..." : "Create Account"}
              </button>
              <NavLink to="/login">
                <button type="button" className="btn btn-link">
                  Back to Login
                </button>
              </NavLink>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Registration;