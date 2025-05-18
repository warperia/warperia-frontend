import React from "react";
import Tippy from "@tippyjs/react";
import { formatNumber, formatDate, decodeHtmlEntities } from "../../utils/helpers.js";

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
      ? "Installed"
      : "Installed"
    : "Install";

  // Determine if the current addon is being installed or updated
  const isInstalling = downloading && installingAddonId === addon.id;

  // Additional metadata
  const lastModified = addon.custom_fields.post_modified ? formatDate(addon.custom_fields.post_modified) : "N/A";
  const postTypeVersionMap = {
    "addon-vanilla": "1.12.1",
    "addon-tbc": "2.4.3",
    "addon-wotlk": "3.3.5",
    "addon-cata": "4.3.4",
    "addon-mop": "5.4.8",
  };
  const gameVersion = postTypeVersionMap[addon.post_type] || addon.post_type;

  // Get the categories from the addon - handle different data structures
  let categories = [];
  if (Array.isArray(addon.addon_categories)) {
    categories = addon.addon_categories.map(category => decodeHtmlEntities(category));
  } else if (addon.addon_categories && typeof addon.addon_categories === 'string') {
    try {
      const parsedCategories = JSON.parse(addon.addon_categories);
      categories = Array.isArray(parsedCategories) 
        ? parsedCategories.map(category => decodeHtmlEntities(category))
        : [];
    } catch (e) {
      categories = addon.addon_categories.split(',').map(category => decodeHtmlEntities(category.trim()));
    }
  } else if (addon.categories && Array.isArray(addon.categories)) {
    categories = addon.categories.map(category => decodeHtmlEntities(category.name));
  }
  
  const maxCategoriesToShow = 3;
  const categoriesToShow = categories.slice(0, maxCategoriesToShow);
  const remainingCategories = categories.slice(maxCategoriesToShow);

  // Get the author's name
  const authorName = renderAddonAuthor(addon, true);

  // Extract the text content if authorName is a React element
  const authorText = React.isValidElement(authorName) ? authorName.props.children : authorName;

  // Check if the author's name is valid
  const author = ["N/A", "Unknown", "Unknown author"].includes(authorText) ? null : authorText;

  return (
    <div
      className="col-12"
      key={addon.id}
      onContextMenu={(e) => handleRightClick(e, addon)}
    >
      <div
        className={`card card-addon browse-addon-card user-select-none ${downloading && installingAddonId === addon.id ? "installing" : ""
          }`}
        onClick={() => handleViewAddon(addon)}
      >
        <div className="wrapper">
          <div className="d-flex">
            <div className="left flex-grow-1">
              <div className="d-flex">
                <div className="image position-relative">
                  <img
                    src={addon.featured_image || "public/default-image.jpg"}
                    alt={addon.title}
                    className="card-img-top img-fluid rounded-0"
                  />
                </div>
                <div className="details text-break center-part align-self-center">
                  <div className="addon-title text-light fw-medium">
                    {addon.title} {" "}
                    {author && (
                      <span className="text-muted"> {" "}
                        by {author}
                      </span>
                    )}
                  </div>
                  {!isInstalling && (
                    <>
                      <div className="mt-2 addon-short text-muted fw-medium">
                        {addon.custom_fields.summary}
                      </div>
                    </>
                  )}
                  {isInstalling && (
                    <div className="addon-progress mt-2">
                      <div className="fw-medium text-muted mb-2">
                        {installingAddonStep}
                      </div>
                      <div className="progress rounded-0">
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
              <div className="buttons ms-auto">
                {!isInstalling && (
                  <button
                    type="button"
                    className={`btn position-relative rounded-0 ${installedAddon
                      ? needsUpdate
                        ? "btn-installed text-muted"
                        : "btn-installed text-muted"
                      : "btn-primary"
                      }`}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (installedAddon) {
                        // if (needsUpdate) {
                        //   handleUpdateAddon(addon);
                        // }
                        // If it's installed but does NOT need an update, we do nothing on click
                      } else {
                        // If not installed, handle install
                        handleInstallAddon(addon, e);
                      }
                    }}
                    disabled={downloading}
                  >
                    {downloading && installingAddonId === addon.id
                      ? "Installing"
                      : buttonText}
                  </button>
                )}
              </div>
            </div>
          </div>
          <hr></hr>
          <div className="d-flex align-items-center justify-content-between">
            <div className="categories">
              <ul>
                <li className="name">Categories</li>
                {categoriesToShow.length > 0 ? (
                  categoriesToShow.map((category, index) => (
                    <React.Fragment key={category}>
                      <li>{category}</li>
                      {index < categoriesToShow.length - 1 && <span className="separator">|</span>}
                    </React.Fragment>
                  ))
                ) : (
                  <li className="text-muted">None</li>
                )}
                {remainingCategories.length > 0 && (
                  <Tippy
                    content={remainingCategories.join(", ")}
                    placement="bottom"
                    className="custom-tooltip"
                  >
                    <li className="more-categories">+{remainingCategories.length}</li>
                  </Tippy>
                )}
              </ul>
            </div>
            <div className="addon-meta fw-medium d-flex align-items-center">
              <Tippy
                content="Downloads"
                placement="bottom"
                className="custom-tooltip"
              >
                <div className="meta-downloads meta-item text-muted d-flex align-items-center gap-1">
                  <i className="bi bi-download me-1"></i>
                  <span>
                    {formatNumber(addon.custom_fields.installs || 0)}
                  </span>
                </div>
              </Tippy>
              <Tippy
                content="Last update date"
                placement="bottom"
                className="custom-tooltip"
              >
                <div className="meta-modified meta-item text-muted d-flex align-items-center gap-1 ms-3">
                  <i className="bi bi-clock me-1"></i>
                  <span>
                    {lastModified}
                  </span>
                </div>
              </Tippy>
              <Tippy
                content="Game Version"
                placement="bottom"
                className="custom-tooltip"
              >
                <div className="meta-version meta-item text-muted d-flex align-items-center gap-1 ms-3">
                  <i className="bi bi-play-circle me-1"></i>
                  <span>
                    {gameVersion}
                  </span>
                </div>
              </Tippy>
            </div>
          </div>
        </div>
      </div>
    </div >
  );
};

export default BrowseAddonCard;
