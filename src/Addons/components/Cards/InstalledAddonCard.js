import React from "react";
import Tippy from "@tippyjs/react";
import { normalizeTitle, decodeHtmlEntities, formatNumber } from "../../utils/helpers.js";

const InstalledAddonCard = ({
  addon,
  installedAddon,
  downloading,
  installingAddonId,
  handleInstallAddon,
  handleUpdateAddon,
  openSwitchVariationModal,
  handleRightClick,
}) => {
  const installedVersion = installedAddon ? installedAddon.localVersion || "1.0.0" : null;
  const backendVersion = addon.custom_fields.version || "1.0.0";
  const needsUpdate = installedAddon && installedVersion !== backendVersion;
  const isCorrupted = installedAddon ? installedAddon.corrupted : false;

  return (
    <div
      className={`col-12 single-addon-row`}
      key={addon.id}
      onContextMenu={(event) => handleRightClick(event, addon)}
    >
      <div
        className={`card card-addon my-addon-card ${
          downloading && installingAddonId === addon.id ? "installing" : ""
        }`}
      >
        <div className="wrapper d-flex align-items-center">
          <div className={`image position-relative`}>
            <img
              src={addon.featured_image || "public/default-image.jpg"}
              alt={addon.title}
              className="card-img-top img-fluid"
            />
          </div>
          <div className="details d-flex justify-content-between flex-wrap">
            <div className="addon-title text-light fw-bold">
              {addon.title}
              {downloading && installingAddonId === addon.id && (
                <div
                  className="spinner-border spinner-addon-title ms-2 text-muted"
                  role="status"
                >
                  <span className="visually-hidden">Loading...</span>
                </div>
              )}
              {!isCorrupted && installedAddon && !needsUpdate && (
                <Tippy content="Installed with the latest version">
                  <i className="bi bi-check-circle-fill text-success ms-2"></i>
                </Tippy>
              )}
              {installedAddon && needsUpdate && !isCorrupted && (
                <Tippy content="Available Update">
                  <i className="bi bi-exclamation-circle-fill text-warning ms-2"></i>
                </Tippy>
              )}
              {isCorrupted && (
                <Tippy content="This addon might be corrupted. Please reinstall.">
                  <i className="bi bi-exclamation-triangle-fill text-warning ms-2"></i>
                </Tippy>
              )}
            </div>
            <div className="ms-auto align-self-center d-flex align-items-center">
              {isCorrupted && (
                <button
                  className="btn btn-outline-secondary-2 rounded-0 me-2"
                  onClick={(e) => handleInstallAddon(addon, e)}
                >
                  {downloading && installingAddonId === addon.id ? "Loading" : "Reinstall"}
                </button>
              )}
              
              {((Array.isArray(addon.custom_fields?.has_variations) &&
                addon.custom_fields.has_variations.length > 0) ||
                (addon.custom_fields?.variation &&
                  addon.custom_fields.variation !== "" &&
                  addon.custom_fields.variation !== "0")) && (
                <Tippy content="Switch Addon Variation" placement="top" className="custom-tooltip">
                  <button
                    className="btn btn-outline-secondary-2 rounded-0 me-2"
                    onClick={() => openSwitchVariationModal(addon)}
                  >
                    <i className="bi bi-arrow-left-right me-1"></i> Switch
                  </button>
                </Tippy>
              )}
              {needsUpdate ? (
                <button
                  className="btn btn-secondary-2 rounded-0 d-flex align-items-center gap-2"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleUpdateAddon(addon); // Trigger update if available
                  }}
                  disabled={downloading && installingAddonId === addon.id}
                >
                  {downloading && installingAddonId === addon.id ? (
                    <>
                      <span
                        className="spinner-border spinner-border-sm"
                        role="status"
                        aria-hidden="true"
                      ></span>
                      <span>Updating</span>
                    </>
                  ) : (
                    <>
                      <i className="bi bi-download text-success me-2"></i>
                      <span>Update</span>
                    </>
                  )}
                </button>
              ) : (
                <Tippy content="Version" placement="top" className="custom-tooltip">
                  <span className="text-muted addon-version">{installedVersion}</span>
                </Tippy>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default InstalledAddonCard;