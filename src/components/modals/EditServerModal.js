import React, { useState, useCallback, useEffect } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { WEB_URL } from "./../../config.js";

function normalizeRealmlistInput(input) {
  let trimmed = input.trim();
  // Remove any leading "set realmlist" or "SET realmlist" prefix (case-insensitive)
  trimmed = trimmed.replace(/^set\s+realmlist\s+/i, "");
  trimmed = trimmed.replace(/^SET\s+realmlist\s+/i, "");

  // Remove surrounding quotes if present
  trimmed = trimmed.replace(/^"(.*)"$/, "$1");

  return trimmed.trim();
}

const EditServerModal = ({ show, onClose, user, server, refreshServers }) => {
  const [serverName, setServerName] = useState("");
  const [serverLogo, setServerLogo] = useState(null);
  const [serverLogoPreview, setServerLogoPreview] = useState(
    "public/default-image.jpg"
  );
  const [gameVersion, setGameVersion] = useState("");
  const [serverPath, setServerPath] = useState("");
  const [dirPath, setDirPath] = useState("");
  const [validationMessage, setValidationMessage] = useState("");
  const [isSaveEnabled, setIsSaveEnabled] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const [serverRealmlist, setServerRealmlist] = useState("");
  const [originalRealmlist, setOriginalRealmlist] = useState("");
  const [localeFolder, setLocaleFolder] = useState(null);

  const [realmlistError, setRealmlistError] = useState("");
  const [failedFilePath, setFailedFilePath] = useState(null);

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [toastType, setToastType] = useState("success");
  const [showToast, setShowToast] = useState(false);

  const navigate = useNavigate();

  const gameVersions = [
    { value: "vanilla", label: "Vanilla", versionPrefix: "1" },
    { value: "tbc", label: "Burning Crusade", versionPrefix: "2" },
    { value: "wotlk", label: "Wrath of the Lich King", versionPrefix: "3" },
    { value: "cata", label: "Cataclysm", versionPrefix: "4" },
    { value: "mop", label: "Mists of Pandaria", versionPrefix: "5" },
  ];

  const knownLocales = [
    "enUS",
    "enGB",
    "deDE",
    "frFR",
    "esES",
    "ruRU",
    "zhCN",
    "zhTW",
    "koKR",
  ];

  const showToastMessage = useCallback((message, type) => {
    setToastMessage(message);
    setToastType(type);
    setShowToast(true);

    const timeoutId = setTimeout(() => setShowToast(false), 5000);
    return () => clearTimeout(timeoutId);
  }, []);

  useEffect(() => {
    if (server) {
      populateFieldsFromServer(server);
    }
  }, [server]);

  useEffect(() => {
    if (!show) resetState();
  }, [show]);

  useEffect(() => {
    if (show && serverPath && gameVersion) {
      validateExistingPathAndLoadRealmlist();
    }
  }, [show, serverPath, gameVersion]);

  const resetState = () => {
    setServerName("");
    setServerLogo(null);
    setServerLogoPreview("public/default-image.jpg");
    setGameVersion("");
    setServerPath("");
    setDirPath("");
    setValidationMessage("");
    setIsSaveEnabled(false);
    setServerRealmlist("");
    setOriginalRealmlist("");
    setLocaleFolder(null);
    setRealmlistError("");
  };

  const populateFieldsFromServer = (server) => {
    setServerName(server.s_name || "");
    setServerLogoPreview(server.s_image || "public/default-image.jpg");
    setGameVersion(server.s_version || "");
    setServerPath(server.s_path || "");
    if (server.s_path) {
      const directoryPath = server.s_path.substring(
        0,
        server.s_path.lastIndexOf("//") !== -1
          ? server.s_path.lastIndexOf("//")
          : server.s_path.lastIndexOf("/")
      );
      setDirPath(directoryPath || "");
    }
    setValidationMessage("");
    setIsSaveEnabled(true);
  };

  const handleLogoSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const validExtensions = ["jpg", "jpeg", "png", "webp"];
    const fileExtension = file.name.split(".").pop().toLowerCase();

    if (file.size > 2 * 1024 * 1024) {
      showToastMessage(
        "The selected image exceeds the maximum file size of 2MB.",
        "light"
      );
      e.target.value = "";
      return;
    }

    if (!validExtensions.includes(fileExtension)) {
      showToastMessage(
        "Please select a valid image file (JPG, PNG, WEBP).",
        "light"
      );
      e.target.value = "";
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      setServerLogo(file);
      setServerLogoPreview(e.target.result);
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const handleRemoveLogo = () => {
    setServerLogo(null);
    setServerLogoPreview("public/default-image.jpg");
  };

  const validateExistingPathAndLoadRealmlist = async () => {
    if (!serverPath || !gameVersion || !dirPath) return;

    try {
      const exePath = serverPath.replace(/\/\//g, "/");
      const version = await window.electron.checkWowVersion(exePath);

      if (!version) {
        setValidationMessage(
          "The selected file does not seem to be a valid World of Warcraft executable."
        );
        setIsSaveEnabled(false);
        return;
      }

      const cleanVersion = version.replace(/^Version\s/, "");
      const expansion = gameVersions.find((v) => v.value === gameVersion);
      const isMop = expansion && expansion.value === "mop";

      if (expansion) {
        const versionPrefix = cleanVersion.split(".")[0];
        if (versionPrefix === expansion.versionPrefix) {
          setValidationMessage(
            `The .exe file appears to match the selected expansion (${expansion.label}).`
          );
          setIsSaveEnabled(true);

          const { locale, realmlist } = await detectLocaleAndReadRealmlist(
            dirPath,
            isMop
          );
          setLocaleFolder(locale);
          setOriginalRealmlist(realmlist || "");
          setServerRealmlist(realmlist || "");
        } else {
          setValidationMessage(
            `The game version doesn't match the ${expansion.label} expansion. This might corrupt your addons. Are you sure you want to continue?`
          );
          setIsSaveEnabled(false);

          // Attempt to load realmlist anyway
          const { locale, realmlist } = await detectLocaleAndReadRealmlist(
            dirPath,
            isMop
          );
          setLocaleFolder(locale);
          setOriginalRealmlist(realmlist || "");
          setServerRealmlist(realmlist || "");
        }
      }
    } catch (error) {
      console.error(
        "Error validating existing path and loading realmlist:",
        error
      );
    }
  };

  const detectLocaleAndReadRealmlist = async (baseDir, isMop) => {
    const dataDir = window.electron.pathJoin(baseDir, "Data");
    try {
      const directories = await window.electron.readDir(dataDir);
      const foundLocale = directories.find((d) => knownLocales.includes(d));
      if (!foundLocale) {
        return { locale: null, realmlist: "" };
      }

      const realmlistFilePath = window.electron.pathJoin(
        dataDir,
        foundLocale,
        "realmlist.wtf"
      );
      const realmlistExists = await window.electron.fileExists(
        realmlistFilePath
      );
      let realmlistValue = "";

      if (realmlistExists) {
        const realmlistContent = await window.electron.readFile(
          realmlistFilePath
        );
        realmlistValue = parseRealmlistFromContent(realmlistContent, false);
      }

      let configRealmlistValue = "";
      // Original logic: configRealmlistValue only read for MoP. You can extend this if desired.
      if (isMop) {
        const configFilePath = window.electron.pathJoin(
          baseDir,
          "WTF",
          "Config.wtf"
        );
        const configExists = await window.electron.fileExists(configFilePath);
        if (configExists) {
          const configContent = await window.electron.readFile(configFilePath);
          configRealmlistValue = parseRealmlistFromContent(configContent, true);
        }
      }

      let finalRealmlist = realmlistValue || configRealmlistValue || "";
      return { locale: foundLocale, realmlist: finalRealmlist };
    } catch (err) {
      console.error("Error detecting locale or reading realmlist:", err);
      return { locale: null, realmlist: "" };
    }
  };

  const parseRealmlistFromContent = (content, isMop) => {
    let lines = content.split("\n").map((l) => l.trim());
    let match = null;
    if (isMop) {
      match = lines.find((l) => l.toLowerCase().startsWith("set realmlist "));
      if (!match) {
        match = lines.find((l) => l.toUpperCase().startsWith("SET REALMLIST "));
      }
      if (match) {
        const regex = /SET\s+realmlist\s+"([^"]+)"/i;
        const found = match.match(regex);
        return found ? found[1] : "";
      }
    } else {
      match = lines.find((l) => l.toLowerCase().startsWith("set realmlist"));
      if (match) {
        const parts = match.split(/\s+/);
        if (parts.length > 2) {
          return parts.slice(2).join(" ");
        }
      }
    }
    return "";
  };

  const handleFileSelect = async () => {
    try {
      const result = await window.electron.showOpenDialog({
        properties: ["openFile"],
        filters: [{ name: "Executable Files", extensions: ["exe"] }],
      });

      if (result.length > 0) {
        const exePath = result[0];
        const directoryPath = exePath.substring(
          0,
          exePath.lastIndexOf("\\") || exePath.lastIndexOf("/")
        );

        setServerPath(exePath);
        setDirPath(directoryPath);

        // Re-run validation
        await validateExistingPathAndLoadRealmlist();
      }
    } catch (err) {
      showToastMessage("Failed to select file. Please try again.", "error");
      console.error("Error selecting file:", err);
    }
  };

  const handleSubmit = async () => {
    if (!serverName || !gameVersion || !serverPath) {
      showToastMessage("Please fill in all required fields.", "error");
      return;
    }

    setIsLoading(true);
    setRealmlistError("");

    try {
      const tokenResult = await window.electron.retrieveToken();
      if (!tokenResult.success || !tokenResult.token) {
        showToastMessage("Error occurred. Please try again later.", "error");
        setIsLoading(false);
        return;
      }

      let newLogoUrl = server.s_image;
      const removeLogo = serverLogoPreview === "/default-image.jpg" && !serverLogo;

      if (serverLogo) {
        const formData = new FormData();
        formData.append("file", serverLogo);

        const uploadResponse = await axios.post(
          `${WEB_URL}/wp-json/wp/v2/users/upload-server-logo`,
          formData,
          {
            headers: {
              Authorization: `Bearer ${tokenResult.token}`,
              "Content-Type": "multipart/form-data",
            },
          }
        );

        newLogoUrl = uploadResponse.data.attachment_url;
      }

      const sanitizedServerPath = serverPath.replace(/\\/g, "//");
      const sanitizedDirPath = sanitizedServerPath
        .substring(
          0,
          sanitizedServerPath.lastIndexOf("//") ||
            sanitizedServerPath.lastIndexOf("/")
        )
        .replace(/\\/g, "//");
      const updatedServer = {
        ...server,
        s_image: removeLogo ? '' : newLogoUrl,
        old_logo_url: server.s_image,
        remove_logo: removeLogo,
        s_name: serverName,
        s_version: gameVersion,
        s_path: sanitizedServerPath,
        s_dir: serverPath === server.s_path ? server.s_dir : sanitizedDirPath,
      };

      const normalizedRealmlist = normalizeRealmlistInput(serverRealmlist);

      // First, update the server meta regardless of realmlist success
      await axios.post(
        `${WEB_URL}/wp-json/wp/v2/users/update-meta`,
        { meta: { user_servers: [updatedServer] } },
        {
          headers: {
            Authorization: `Bearer ${tokenResult.token}`,
            "Content-Type": "application/json",
          },
        }
      );

      // Now attempt to update realmlist if changed and not empty
      if (
        normalizedRealmlist &&
        normalizedRealmlist.trim() !== originalRealmlist.trim() &&
        dirPath &&
        localeFolder
      ) {
        try {
          await updateRealmlistOnDisk(
            dirPath,
            localeFolder,
            normalizedRealmlist
          );
          // If success, show success and close modal
          showToastMessage("Server updated successfully!", "success");
          onClose();
          refreshServers();
        } catch (error) {
          setIsLoading(false);
          if (error.filePath) {
            setFailedFilePath(error.filePath);
            setRealmlistError(
              `${error.filePath} couldn't be updated. Please make sure the file is not marked as "Read-only".`
            );
          } else {
            setRealmlistError(
              `Your other changes have been saved, but the realmlist could not be updated. Please check file permissions and try again.`
            );
          }
        }
      } else {
        // No realmlist changes or no conditions to write it, just close normally
        showToastMessage("Server updated successfully!", "success");
        onClose();
        refreshServers();
      }
    } catch (error) {
      console.error("Error updating server:", error);
      showToastMessage("Error occurred. Please try again later.", "error");
      setIsLoading(false);
    }
  };

  const updateRealmlistOnDisk = async (baseDir, locale, newRealmlist) => {
    if (!locale || !newRealmlist) return; // If no locale or empty, skip

    const dataLocalePath = window.electron.pathJoin(
      baseDir,
      "Data",
      locale,
      "realmlist.wtf"
    );
    const realmlistExists = await window.electron.fileExists(dataLocalePath);
    let currentDataContent = realmlistExists
      ? await window.electron.readFile(dataLocalePath)
      : "";

    let updatedDataContent = setOrReplaceRealmlistLine(
      currentDataContent,
      newRealmlist,
      false
    );

    // Always attempt to overwrite, even if file didn't exist before.
    await safeOverwriteFile(dataLocalePath, updatedDataContent);

    const configPath = window.electron.pathJoin(baseDir, "WTF", "Config.wtf");
    const configExists = await window.electron.fileExists(configPath);
    let configContent = configExists
      ? await window.electron.readFile(configPath)
      : "";

    let updatedConfigContent = setOrReplaceRealmlistLine(
      configContent,
      newRealmlist,
      true
    );

    // Always overwrite Config.wtf, creating it if missing.
    await safeOverwriteFile(configPath, updatedConfigContent);
  };

  const safeOverwriteFile = async (filePath, fileData) => {
    try {
      // writeFile will create the file if it does not exist
      await window.electron.overwriteFile(filePath, fileData);
    } catch (err) {
      console.error(`Error overwriting file: ${filePath}`, err);
      err.filePath = filePath;
      throw err;
    }
  };

  const setOrReplaceRealmlistLine = (content, newRealmlist, isMop) => {
    let lines = content.split("\n");
    let foundIndex = -1;

    const searchRegex = isMop ? /^SET\s+realmlist\s+/i : /^set\s+realmlist\s+/i;
    const newLine = isMop
      ? `SET realmlist "${newRealmlist}"`
      : `set realmlist ${newRealmlist}`;

    for (let i = 0; i < lines.length; i++) {
      if (lines[i].match(searchRegex)) {
        foundIndex = i;
        break;
      }
    }

    if (foundIndex >= 0) {
      lines[foundIndex] = newLine;
    } else {
      lines.push(newLine);
    }

    return lines.join("\n");
  };

  const handleAttemptFix = async () => {
    // Extract filePath from the error message if stored or stored in state.
    // If we attached filePath to error, we can keep it in a state variable.
    // Let's assume we have stored it in a state variable 'failedFilePath'.
    if (!failedFilePath) return;

    try {
      const result = await window.electron.fixFilePermissions(failedFilePath);
      if (result.success) {
        showToastMessage(
          "File permissions updated successfully, trying again...",
          "success"
        );
        // Attempt to overwrite again
        try {
          await updateRealmlistOnDisk(
            dirPath,
            localeFolder,
            normalizeRealmlistInput(serverRealmlist)
          );
          showToastMessage("Server updated successfully!", "success");
          onClose();
          refreshServers();
        } catch (retryError) {
          console.error("Retry failed:", retryError);
          showToastMessage(
            "Still unable to update realmlist after fixing permissions. Please manually adjust file permissions.",
            "error"
          );
        }
      }
    } catch (err) {
      console.error("Failed to fix file permissions:", err);
      showToastMessage(
        "Failed to fix file permissions. Please manually adjust them and try again.",
        "error"
      );
    }
  };

  const handleDeleteServer = async () => {
    if (!server || !server.s_id || !user) {
      showToastMessage("Invalid server or user data.", "error");
      return;
    }

    setIsDeleting(true);

    try {
      const tokenResult = await window.electron.retrieveToken();
      if (!tokenResult.success || !tokenResult.token) {
        showToastMessage("Unauthorized request.", "error");
        setIsDeleting(false);
        return;
      }

      const response = await axios.post(
        `${WEB_URL}/wp-json/wp/v2/users/delete-server`,
        { s_id: server.s_id },
        {
          headers: {
            Authorization: `Bearer ${tokenResult.token}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (response.data.message === "Server deleted successfully") {
        showToastMessage("Server deleted successfully.", "success");
        setShowDeleteModal(false);
        onClose();
        refreshServers();
      } else {
        showToastMessage("Failed to delete server. Please try again.", "error");
      }
    } catch (error) {
      console.error("Error deleting server:", error);
      showToastMessage("An error occurred. Please try again.", "error");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <>
      {show && <div className="modal-overlay"></div>}
      <div
        className={`modal fade ${show ? "show d-block" : ""}`}
        tabIndex="-1"
        role="dialog"
        style={{ display: show ? "block" : "none" }}
      >
        <div className="modal-dialog modal-dialog-centered modal-lg modal-dialog-scrollable modal-dark modal-add-user-server">
          <div className="modal-content">
            <div className="modal-header">
              <h5 className="modal-title">Edit Server</h5>
              <button
                type="button"
                className="btn-close btn-close-white"
                aria-label="Close"
                onClick={onClose}
              ></button>
            </div>
            <div className="modal-body">
              {isLoading ? (
                <div className="text-center">
                  <div className="spinner-border text-light" role="status">
                    <span className="visually-hidden">Loading...</span>
                  </div>
                </div>
              ) : (
                <form>
                  {/* Server Name */}
                  <div className="mb-4">
                    <label
                      htmlFor="serverName"
                      className="form-label fw-medium"
                    >
                      Name
                    </label>
                    <input
                      type="text"
                      className="form-control"
                      id="serverName"
                      value={serverName}
                      onChange={(e) => setServerName(e.target.value)}
                      required
                    />
                  </div>

                  {/* Logo */}
                  <div className="server-logo mb-4">
                    <label className="form-label fw-medium">Logo</label>
                    <div className="d-flex align-items-center gap-2">
                      <img
                        src={serverLogoPreview}
                        alt="Server Logo"
                        className="img-fluid"
                        onClick={() =>
                          document.getElementById("editServerLogoInput").click()
                        }
                      />
                      <input
                        type="file"
                        id="editServerLogoInput"
                        accept="image/*"
                        style={{ display: "none" }}
                        onChange={handleLogoSelect}
                      />
                      {(serverLogo ||
                        serverLogoPreview !== "public/default-image.jpg") && (
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={handleRemoveLogo}
                        >
                          Remove Image
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Expansion */}
                  <div className="server-game-version mb-4">
                    <label className="form-label fw-medium">Expansion</label>
                    <div className="d-flex flex-wrap gap-2">
                      {gameVersions.map((version) => (
                        <button
                          type="button"
                          key={version.value}
                          className={`btn ${
                            gameVersion === version.value
                              ? "active"
                              : "btn-outline-secondary"
                          }`}
                          onClick={() => {
                            setGameVersion(version.value);
                            setValidationMessage("");
                            setIsSaveEnabled(false);
                            setServerRealmlist("");
                            setOriginalRealmlist("");
                            setServerPath("");
                            setDirPath("");
                          }}
                        >
                          {version.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Game Path */}
                  <div className="mb-4 server-game-path position-relative">
                    <label
                      htmlFor="serverPath"
                      className="form-label fw-medium mb-0"
                    >
                      Game Path
                    </label>
                    <div
                      id="pathHelpBlock"
                      className="form-text text-muted fw-medium mt-0 mb-1"
                    >
                      Select the executable{" "}
                      <span className="fw-bold text-primary">(WoW.exe)</span>{" "}
                      file that you use to play the game from your installation
                      directory.
                    </div>
                    <div className="position-relative">
                      <input
                        type="text"
                        className="form-control"
                        id="serverPath"
                        value={serverPath}
                        placeholder="Select the WoW executable file"
                        aria-describedby="pathHelpBlock"
                        style={{ paddingRight: "90px" }}
                        readOnly
                        required
                      />
                      <button
                        type="button"
                        className="btn btn-browse position-absolute top-50 translate-middle-y"
                        onClick={handleFileSelect}
                        style={{ right: "10px", height: "80%", zIndex: 10 }}
                      >
                        Browse
                      </button>
                    </div>
                  </div>

                  {/* Validation Message */}
                  {validationMessage && (
                    <div
                      className={`alert ${
                        isSaveEnabled ? "alert-path-success" : "alert-path-info"
                      } border-0 fw-bold`}
                    >
                      <div className="d-flex align-items-center gap-2">
                        <i
                          className={`bi ${
                            isSaveEnabled
                              ? "bi-check-circle-fill"
                              : "bi-exclamation-circle-fill"
                          }`}
                        ></i>
                        <div>{validationMessage}</div>
                      </div>
                      {!isSaveEnabled &&
                        validationMessage.includes(
                          "This might corrupt your addons"
                        ) && (
                          <button
                            className="btn btn-sm btn-secondary mt-2"
                            onClick={() => setIsSaveEnabled(true)}
                          >
                            Confirm Selection
                          </button>
                        )}
                    </div>
                  )}

                  {/* Realmlist Input Field */}
                  {dirPath && localeFolder && (
                    <div className="mb-4 server-game-realmlist">
                      <label
                        htmlFor="realmlistInput"
                        className="form-label fw-medium mb-0"
                      >
                        Realmlist
                      </label>
                      <div className="form-text text-muted fw-medium mt-0 mb-1">
                        Set the realmlist to the server you'd like to connect
                        to.
                      </div>
                      <div className="input-group mb-3">
                        <span className="input-group-text" id="set-realmlist">
                          set realmlist
                        </span>
                        <input
                          type="text"
                          className="form-control"
                          id="realmlistInput"
                          value={serverRealmlist}
                          onChange={(e) => setServerRealmlist(e.target.value)}
                          placeholder="e.g. logon.yourserver.com"
                          aria-describedby="set-realmlist"
                        />
                      </div>
                      {realmlistError && (
                        <div
                          className="alert alert-path-info fw-medium"
                          role="alert"
                        >
                          <div className="d-flex gap-2 fw-bold">
                            <i className="bi bi-exclamation-circle-fill"></i>
                            <span>Error:</span>
                          </div>
                          <p class="mb-0">{realmlistError}</p>
                          {/* Check if we know which file caused the issue */}
                          {realmlistError.includes("couldn't be updated") && (
                            <div className="d-flex align-items-center gap-2 mt-2">
                              <span className="fw-bold">
                                Would you like Warperia to try and fix the issue
                                for you?
                              </span>
                              <button
                                type="button"
                                className="btn btn-secondary btn-sm fw-bold"
                                onClick={handleAttemptFix}
                              >
                                <i className="bi bi-wrench-adjustable"></i>{" "}
                                Attempt To Fix
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </form>
              )}
            </div>
            <div className="modal-footer justify-content-between">
              {!isLoading && (
                <>
                  <button
                    type="button"
                    className="btn btn-danger"
                    onClick={() => setShowDeleteModal(true)}
                  >
                    <i className="bi bi-trash"></i> Delete Server
                  </button>
                  <div className="d-flex align-items-center gap-2">
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={onClose}
                    >
                      <i className="bi bi-x-lg"></i> Cancel
                    </button>
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={handleSubmit}
                      disabled={!isSaveEnabled}
                    >
                      <i className="bi bi-check-lg"></i> Save Changes
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Toast Notifications */}
      {showToast && (
        <div
          className="toast-container position-fixed bottom-0 end-0 p-3"
          style={{ zIndex: 11 }}
        >
          <div
            className={`toast show text-bg-${toastType}`}
            role="alert"
            aria-live="assertive"
            aria-atomic="true"
          >
            <div className="toast-header">
              <strong className="me-auto">
                <i className="bi bi-bell"></i> Notification
              </strong>
              <button
                type="button"
                className="btn-close btn-close-white"
                aria-label="Close"
                onClick={() => setShowToast(false)}
              ></button>
            </div>
            <div className="toast-body">{toastMessage}</div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <>
          <div className="modal-overlay delete-modal-overlay"></div>
          <div
            className="modal fade show d-block modal-delete"
            tabIndex="-1"
            role="dialog"
          >
            <div className="modal-dialog modal-dialog-centered modal-dark">
              <div className="modal-content">
                <div className="modal-body">
                  <p className="text-danger fw-medium h5">
                    <i className="bi bi-exclamation-circle-fill"></i> Hold up!
                  </p>
                  <p className="fw-medium">
                    Are you sure you want to delete this server instance? This
                    action is permanent and can't be undone.
                  </p>
                </div>
                <div className="modal-footer justify-content-between border-0">
                  <button
                    type="button"
                    className="btn btn-outline-secondary-2"
                    onClick={() => setShowDeleteModal(false)}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="btn btn-danger"
                    onClick={handleDeleteServer}
                    disabled={isDeleting}
                  >
                    {isDeleting ? (
                      <span className="spinner-border spinner-border-sm me-2"></span>
                    ) : (
                      <i></i>
                    )}
                    Yes, delete
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
};

export default EditServerModal;
