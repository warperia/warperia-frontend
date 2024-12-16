import React from "react";
import Tippy from "@tippyjs/react";
import { formatNumber } from "../../utils/helpers.js";

const BrowseAddonCard = ({
  addon,
  installedAddon,
  downloading,
  installingAddonId,
  handleInstallAddon,
  handleUpdateAddon,
  handleRightClick,
  renderAddonAuthor,
}) => {
  // Check if the addon is installed
  const installedVersion = installedAddon ? installedAddon.localVersion || "1.0.0" : null;
  const backendVersion = addon.custom_fields.version || "1.0.0"; // Addon version from the backend

  // Determine if the addon needs an update
  const needsUpdate = installedAddon && installedVersion !== backendVersion;
  const buttonText = installedAddon ? (needsUpdate ? "Update" : "Installed") : "Install";

  return (
    <div
      className="col-12 col-xl-6"
      key={addon.id}
      onContextMenu={(event) => handleRightClick(event, addon)}
    >
      <div
        className={`card card-addon browse-addon-card ${
          downloading && installingAddonId === addon.id ? "installing" : ""
        }`}
      >
        <div className="wrapper d-flex align-items-center">
          <div className="image position-relative">
            <img
              src={addon.featured_image || "public/default-image.jpg"}
              alt={addon.title}
              className="card-img-top img-fluid"
            />
            <button
              type="button"
              className={`btn position-absolute ${
                installedAddon
                  ? needsUpdate
                    ? "btn-update"
                    : "btn-installed"
                  : "btn-primary"
              }`}
              onClick={(e) =>
                installedAddon
                  ? needsUpdate
                    ? handleUpdateAddon(addon)
                    : null
                  : handleInstallAddon(addon, e)
              }
              disabled={downloading}
              title={`${installedVersion || ""} - ${backendVersion}`}
            >
              {downloading && installingAddonId === addon.id ? "Installing" : buttonText}
            </button>
          </div>
          <div className="details">
            <div className="addon-title text-light fw-bold">
              {addon.title}
            </div>
            <div className="mt-1 mb-2 addon-short text-muted fw-bold">
              {addon.custom_fields.summary}
            </div>
            <div className="addon-meta d-flex align-items-center">
              <div className="meta-downloads fw-medium text-muted d-flex align-items-center gap-1">
                <i className="bi bi-download"></i>
                <span>{formatNumber(addon.custom_fields.installs || 0)} Installs</span>
              </div>
              <span className="mx-2 text-muted">•</span>
              <Tippy content="Author" placement="top" className="custom-tooltip">
                <div className="meta-author fw-medium text-muted">
                  {renderAddonAuthor(addon)}
                </div>
              </Tippy>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BrowseAddonCard;