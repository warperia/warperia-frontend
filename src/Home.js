import React, { useEffect, useState } from "react";
import axios from "axios";
import "bootstrap/dist/css/bootstrap.min.css";
import Sidebar from "./Sidebar.js";
import { WEB_URL } from "./config.js";

import { useNavigate } from "react-router-dom";

const Home = ({ user, setPage }) => {
  const navigate = useNavigate();

  // State for application version
  const [appVersion, setAppVersion] = useState("");

  // State for private servers
  const [servers, setServers] = useState([]);

  // Loading state
  const [loading, setLoading] = useState(true);

  // State for user's servers
  const [userServers, setUserServers] = useState([]);
  const [userServersLoading, setUserServersLoading] = useState(false);

  // Fetch the application version
  useEffect(() => {
    const fetchAppVersion = async () => {
      try {
        const result = await window.electron.ipcRenderer.invoke(
          "get-app-version"
        );
        setAppVersion(result.version);
      } catch (error) {
        console.error("Error fetching app version:", error);
      }
    };
    fetchAppVersion();
  }, []);

  // Fetch the private servers custom post type from the backend
  useEffect(() => {
    const fetchServers = async () => {
      try {
        setLoading(true);
        const response = await axios.get(`${WEB_URL}/wp-json/wp/v2/server`, {
          params: {
            _embed: true,
            per_page: 10,
          },
        });

        const serversData = response.data.map((server) => ({
          id: server.id,
          title: server.title.rendered,
          content: server.content.rendered,
          link: server.meta_box.server_website_link || "#",
          featuredImage:
            server._embedded?.["wp:featuredmedia"]?.[0]?.source_url || null,
        }));

        setServers(serversData);
      } catch (error) {
        console.error("Error fetching servers:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchServers();
  }, []);

  // 3) Fetch the user's server instances
  useEffect(() => {
    const fetchUserServers = async () => {
      try {
        if (!user || !user.id) return;
        setUserServersLoading(true);

        // Retrieve the token from Electron
        const tokenResult = await window.electron.retrieveToken();
        if (tokenResult.success && tokenResult.token) {
          // Fetch the user’s data from the backend
          const response = await fetch(
            `${WEB_URL}/wp-json/wp/v2/users/${user.id}`,
            {
              headers: {
                Authorization: `Bearer ${tokenResult.token}`,
              },
            }
          );
          const data = await response.json();

          // Extract the servers from the meta data
          let serversList = data.meta.user_servers || [];

          // Convert to array
          if (typeof serversList === "string") {
            serversList = JSON.parse(serversList);
          } else if (!Array.isArray(serversList)) {
            serversList = Object.values(serversList);
          }

          setUserServers(serversList);
        }
      } catch (error) {
        console.error("Error fetching user servers:", error);
      } finally {
        setUserServersLoading(false);
      }
    };

    fetchUserServers();
  }, [user]);

  // Helper to navigate to the single server page
  const goToServerPage = (index) => {
    navigate(`/server/${index}`);
  };

  return (
    <div className="d-flex homepage h-100">
      <Sidebar setPage={setPage} />
      <div className="content flex-grow-1">

        {/* Welcome */}
        <section className="container border-bottom border-dark pb-5">
          <div className="col-lg-6">
            <h1 className="display-5 text-white fw-bold welcome-title">
              Your Addons
              <br />
              In One <span className="text-gradient">Centralized Hub</span>
            </h1>
            <p className="text-muted">Warperia is a new seamless way of browsing and installing addons for World of Warcraft private servers.</p>
            <div className="d-flex align-items-center">
              <span className="badge bg-warning text-black">
                App version: {appVersion}
              </span>
            </div>
          </div>
        </section>

        {/* My Servers */}
        {userServersLoading ? (
          <div className="container py-5 d-flex justify-content-center">
            <div className="spinner-border text-white" role="status">
              <span className="visually-hidden">Loading user servers...</span>
            </div>
          </div>
        ) : (
          // Only show if user has servers instances added
          userServers.length > 0 && (
            <section className="container py-5">
              <h2 className="text-white fw-medium fs-5 fw-medium mb-1">
                Server Instances
              </h2>
              <p className="text-muted mb-4">
                Manage your addons based on the created server instances
              </p>

              <div className="row row-cols-1 row-cols-md-2 align-items-center g-4">
                {userServers.slice(0, 4).map((server, index) => (
                  <div className="col" key={index}>
                    <div
                      className="card card-server h-100 text-decoration-none cursor-pointer"
                      onClick={() => goToServerPage(index)}
                    >
                      <div className="card-body d-flex align-items-center">
                        <img
                          src={server.s_image || "public/default-image.jpg"}
                          className="img-fluid me-3"
                          alt={server.s_name || "Server"}
                        />
                        <div className="server-content">
                          <div className="card-title text-white fw-medium mb-1">
                            {server.s_name || "Unnamed Server"}
                          </div>
                          <div className="card-text text-muted">
                            {server.s_version
                              ? server.s_version.toUpperCase()
                              : "Unknown"}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {userServers.length > 4 && (
                <div className="mt-4 d-flex align-items-center justify-content-center">
                  <button
                    className="btn btn-secondary"
                    onClick={() => {
                      navigate("/servers");
                    }}
                  >
                    View all servers
                  </button>
                </div>
              )}
            </section>
          )
        )}

        {/* Public Servers */}
        <section className="container py-5">
          <h2 className="text-white fw-bold fs-4">Private Servers</h2>
          <p className="text-muted mb-4 fw-medium">
            Looking for a new place to play? You might find the following servers interesting
          </p>
          {loading ? (
            <div className="text-center">
              <div className="spinner-border text-white" role="status">
                <span className="visually-hidden">Loading servers...</span>
              </div>
            </div>
          ) : servers.length > 0 ? (
            <div className="row row-cols-1 row-cols-md-2 align-items-center g-4">
              {servers.map((server) => (
                <div className="col" key={server.id}>
                  <a
                    href={server.link}
                    className="card card-server h-100 text-decoration-none"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <div className="card-body d-flex align-items-center">
                      {server.featuredImage && (
                        <img
                          src={server.featuredImage}
                          className="img-fluid"
                          alt={server.title}
                        />
                      )}
                      <div className="server-content">
                        <div className="card-title text-white fw-medium mb-1">
                          {server.title}
                        </div>
                        <div
                          className="card-text text-muted"
                          dangerouslySetInnerHTML={{ __html: server.content }}
                        ></div>
                      </div>
                    </div>
                  </a>
                </div>
              ))}
              <p className="text-muted helptext">
                Do you want to add your server here? Get in touch with us on
                Discord.
              </p>
            </div>
          ) : (
            <p className="text-muted">No servers available at the moment.</p>
          )}
        </section>
      </div>
    </div>
  );
};

export default Home;