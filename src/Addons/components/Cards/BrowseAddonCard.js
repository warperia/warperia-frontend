import React from "react";
import Tippy from "@tippyjs/react";
import { formatNumber } from "../../utils/helpers.js";

const BrowseAddonCard = ({
  addon,
  installedAddon,
  downloading,
  installingAddonId,
  installingAddonStep,
  progress,
  handleInstallAddon,
  handleUpdateAddon,
  handleRightClick,
  renderAddonAuthor,
  handleViewAddon
}) => {
  // Check if the addon is installed
  const installedVersion = installedAddon
    ? installedAddon.localVersion || "1.0.0"
    : null;
  const backendVersion = addon.custom_fields.version || "1.0.0"; // Addon version from the backend

  // Determine if the addon needs an update
  const needsUpdate = installedAddon && installedVersion !== backendVersion;
  const buttonText = installedAddon
    ? needsUpdate
      ? "Update"
      : "Installed"
    : "Install";

  // Determine if the current addon is being installed or updated
  const isInstalling = downloading && installingAddonId === addon.id;

  return (
    <div
      className="col-12"
      key={addon.id}
      onContextMenu={(e) => handleRightClick(e, addon)}
    >
      <div
        className={`card card-addon browse-addon-card ${downloading && installingAddonId === addon.id ? "installing" : ""
          }`}
        onClick={() => handleViewAddon(addon)}
      >
        <div className="wrapper d-flex align-items-center">
          <div className="left flex-grow-1">
            <div className="d-flex">
              <div className="image position-relative">
                <img
                  src={addon.featured_image || "public/default-image.jpg"}
                  alt={addon.title}
                  className="card-img-top img-fluid"
                />
              </div>
              <div className="details text-break center-part align-self-center">
                <div className="addon-title text-light fw-medium">
                  {addon.title}{" "}
                  <span className="text-muted">
                    by {renderAddonAuthor(addon, true)}
                  </span>
                </div>
                {!isInstalling && (
                  <>
                    <div className="mt-1 mb-2 addon-short text-muted fw-medium">
                      {addon.custom_fields.summary}
                    </div>
                    <div className="addon-meta d-flex align-items-center">
                      <div className="meta-downloads text-muted d-flex align-items-center gap-1">
                        <i className="bi bi-download"></i>
                        <span>
                          {formatNumber(addon.custom_fields.installs || 0)} Installs
                        </span>
                      </div>
                    </div>
                  </>
                )}
                {isInstalling && (
                  <div className="addon-progress mt-2">
                    <div className="fw-medium text-muted mb-2">
                      {installingAddonStep}
                    </div>
                    <div className="progress">
                      <div
                        className="progress-bar progress-bar-animated fw-bold"
                        role="progressbar"
                        style={{ width: `${progress}%` }}
                        aria-valuenow={progress}
                        aria-valuemin="0"
                        aria-valuemax="100"
                      >
                        {progress}%
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
          <div className="right">
            <div className="buttons ms-auto align-self-center">
              {!isInstalling && (
                <button
                  type="button"
                  className={`btn position-relative ${installedAddon
                    ? needsUpdate
                      ? "btn-update btn-primary"
                      : "btn-installed text-muted"
                    : "btn-primary"
                    }`}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (installedAddon) {
                      if (needsUpdate) {
                        handleUpdateAddon(addon);
                      }
                      // If it's installed but does NOT need an update, we do nothing on click
                      // or you could do something else if needed.
                    } else {
                      // If not installed, handle install
                      handleInstallAddon(addon, e);
                    }
                  }}
                  disabled={downloading}
                  title={`${installedVersion || ""} - ${backendVersion}`}
                >
                  {downloading && installingAddonId === addon.id
                    ? "Installing"
                    : buttonText}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BrowseAddonCard;
