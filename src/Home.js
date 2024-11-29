import React, { useEffect, useState } from "react";
import axios from "axios";
import "bootstrap/dist/css/bootstrap.min.css";
import Sidebar from "./Sidebar.js";
import { WEB_URL } from "./config.js";

const Home = ({ user, setPage }) => {
  const [appVersion, setAppVersion] = useState("");
  const [servers, setServers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Fetch the app version from the Electron main process
    const fetchAppVersion = async () => {
      try {
        const result = await window.electron.ipcRenderer.invoke("get-app-version");
        setAppVersion(result.version);
      } catch (error) {
        console.error("Error fetching app version:", error);
      }
    };

    fetchAppVersion();
  }, []);

  useEffect(() => {
    // Fetch the servers the WordPress backend
    const fetchServers = async () => {
      try {
        setLoading(true);
        const response = await axios.get(`${WEB_URL}/wp-json/wp/v2/server`, {
          params: {
            _embed: true,
            per_page: 10,
          },
        });

        // Map the response data to include necessary fields
        const serversData = response.data.map((server) => ({
          id: server.id,
          title: server.title.rendered,
          content: server.content.rendered,
          link: server.meta_box.server_website_link || "#",
          featuredImage: server._embedded?.["wp:featuredmedia"]?.[0]?.source_url || null,
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

  return (
    <div className="d-flex homepage h-100">
      <Sidebar setPage={setPage} />
      <div className="content flex-grow-1">
        {/* Welcome Section */}
        <section className="container border-bottom border-dark pb-5">
          <div className="col-lg-6">
            <h1 className="display-5 text-white fw-bolder welcome-title">Your Addons<br></br>In One <span className="text-gradient">Centralized Hub</span></h1>
            <div className="d-flex align-items-center">
              <span className="badge bg-warning text-black ms-2">v{appVersion} beta</span>
            </div>
          </div>
        </section>

        {/* Servers Section */}
        <section className="container py-5">
          <h2 className="text-white fw-bolder fs-4">Private Servers</h2>
          <p className="text-muted mb-4 fw-bold">Showcase your World of Warcraft Private Server</p>
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
                        <div className="card-title text-white fw-bold mb-0">{server.title}</div>
                        <div
                          className="card-text text-muted"
                          dangerouslySetInnerHTML={{ __html: server.content }}
                        ></div>
                      </div>
                    </div>
                  </a>
                </div>
              ))}
              <p className="text-muted">Do you want to add your server here? Get in touch with us on Discord.</p>
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
