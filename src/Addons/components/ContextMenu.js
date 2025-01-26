import React, { useEffect, useState, useRef } from "react";
import { createPortal } from "react-dom";

/**
 * Bounds a desired (x, y) so it doesn’t overflow screen edges
 */
function adjustForScreen(x, y, menuWidth, menuHeight) {
  const margin = 10;
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  let newX = x;
  let newY = y;

  if (newX + menuWidth > vw) {
    newX = vw - menuWidth - margin;
  }

  if (newY + menuHeight > vh) {
    newY = vh - menuHeight - margin;
  }

  return { x: newX, y: newY };
}

const ContextMenu = ({
  xPos,
  yPos,
  visible,
  isInstalled,
  addonImage,
  addonName,
  addonData,
  folderList = [],
  onOpenAddonFolder,
  onReinstall,
  onInstall,
  onDelete,
  onReport,
  onViewAddon,
  onViewOnWarperia,
}) => {
  const menuRef = useRef(null);

  // Main menu adjusted position
  const [adjusted, setAdjusted] = useState({ x: xPos, y: yPos });

  // Submenu
  const [submenuOpen, setSubmenuOpen] = useState(false);
  const [submenuPos, setSubmenuPos] = useState({ x: 0, y: 0 });
  const submenuRef = useRef(null);

  useEffect(() => {
    if (!visible) return;
    const menuEl = menuRef.current;
    if (!menuEl) return;

    // Adjust the main context menu so it doesn’t overflow
    const { offsetWidth: mw, offsetHeight: mh } = menuEl;
    const { x, y } = adjustForScreen(xPos, yPos, mw, mh);
    setAdjusted({ x, y });

    // Close any open submenu on fresh open
    setSubmenuOpen(false);
  }, [visible, xPos, yPos]);

  const handleOpenFolderClick = (evt) => {
    evt.stopPropagation();
    if (!submenuRef.current) {
      setSubmenuOpen(true);
      return;
    }
    setSubmenuOpen((prev) => !prev);
  };

  useEffect(() => {
    if (!submenuOpen) return;
    const menuEl = menuRef.current;
    const subEl = submenuRef.current;
    if (!menuEl || !subEl) return;

    // Temporarily show to measure it
    subEl.style.display = "block";

    // Find the Open folder button by a ref or by query
    const folderBtn = menuEl.querySelector(".open-folder-trigger");
    if (!folderBtn) {
      // fallback: place it below the entire menu
      const { offsetWidth: subW, offsetHeight: subH } = subEl;
      let desiredX = adjusted.x + menuEl.offsetWidth; // to the right
      let desiredY = adjusted.y;
      // Adjust for screen edges
      const { x, y } = adjustForScreen(desiredX, desiredY, subW, subH);
      setSubmenuPos({ x, y });
      return;
    }

    // offsetTop from the parent .context-menu
    const rectMenu = menuEl.getBoundingClientRect();
    const rectBtn = folderBtn.getBoundingClientRect();
    const { offsetWidth: subW, offsetHeight: subH } = subEl;

    let desiredX = rectMenu.right;
    let desiredY = rectBtn.top;

    // Adjust for screen edges
    const { x, y } = adjustForScreen(desiredX, desiredY, subW, subH);

    setSubmenuPos({ x, y });
  }, [submenuOpen, adjusted]);

  /**
   * If the user re‐closes the submenu, hide it.
   */
  useEffect(() => {
    if (!submenuOpen && submenuRef.current) {
      submenuRef.current.style.display = "none";
    }
    if (submenuOpen && submenuRef.current) {
      submenuRef.current.style.display = "block";
    }
  }, [submenuOpen]);

  // Renders the Open folder menu item(s).
  const renderOpenFolderMenu = () => {
    if (!isInstalled || folderList.length === 0) return null;

    // If only 1 folder => direct action
    if (folderList.length === 1) {
      const [folderName] = folderList[0];
      return (
        <li>
          <button
            className="btn btn-link text-decoration-none p-2 w-100 d-flex justify-content-between"
            onClick={() => onOpenAddonFolder(addonData, folderName)}
          >
            <span><i className="bi bi-folder-fill me-2"></i> Browse Folder</span>
            <i className="bi bi-box-arrow-up-right"></i>
          </button>
        </li>
      );
    }

    // Multiple => a submenu
    return (
      <li>
        <button
          className="btn btn-link text-decoration-none p-2 w-100 d-flex justify-content-between open-folder-trigger"
          style={{ cursor: "pointer" }}
          onClick={handleOpenFolderClick}
        >
          <span><i className="bi bi-folder-fill me-2"></i> Browse Folder</span>
          <i
            className={`bi ${submenuOpen ? "bi-chevron-left" : "bi-chevron-right"
              }`}
          />
        </button>
      </li>
    );
  };

  // Listing sub‐folders
  const SubMenuPortal = () => {
    if (!submenuOpen || folderList.length <= 1) return null;

    return createPortal(
      <div
        ref={submenuRef}
        className="context-submenu bg-dark"
        style={{
          position: "absolute",
          top: submenuPos.y,
          left: submenuPos.x,
          maxHeight: "300px",
          overflowY: "auto",
          border: "1px solid rgba(99,99,99,0.1)",
          zIndex: 1500,
        }}
      >
        <ul className="list-unstyled m-0 p-0">
          {folderList.map(([folderName]) => (
            <li key={folderName}>
              <button
                className="btn btn-link text-decoration-none p-2 w-100 d-flex align-items-center justify-content-between"
                onClick={() => {
                  setSubmenuOpen(false);
                  onOpenAddonFolder(addonData, folderName);
                }}
              >
                <span>{folderName}</span>
                <i className="bi bi-box-arrow-up-right"></i>
              </button>
            </li>
          ))}
        </ul>
      </div>,
      document.body
    );
  };

  // If the main menu is invisible, do not render at all
  if (!visible) {
    return null;
  }

  return (
    <>
      <div
        ref={menuRef}
        className="context-menu w-100 bg-dark"
        style={{
          position: "absolute",
          top: adjusted.y,
          left: adjusted.x,
          zIndex: 1000,
        }}
      >
        <div className="d-flex flex-column align-items-center">
          <div className="d-flex align-items-center gap-3 context-menu-top w-100 px-2">
            <img
              src={addonImage}
              alt={addonName}
              className="img-fluid rounded"
              style={{ width: 40, height: 40, objectFit: "cover" }}
            />
            <div className="addon-name text-light fw-medium">{addonName}</div>
          </div>
          <div className="context-menu-bottom w-100">
            <hr></hr>
            <ul className="list-unstyled m-0">
              <li>
                <button
                  className="btn btn-link text-decoration-none p-2 w-100 d-flex justify-content-between"
                  onClick={(e) => {
                    if (isInstalled) {
                      onReinstall();
                    } else {
                      onInstall(addonData, e);
                    }
                  }}
                >
                  <span>
                    <i className="bi bi-download me-2"></i>
                    {isInstalled ? "Reinstall" : "Install"}
                  </span>
                </button>
              </li>

              <li>
                <button
                  className="btn btn-link text-decoration-none p-2 w-100 d-flex justify-content-between"
                  onClick={() => onViewAddon(addonData)}
                >
                  <span><i className="bi bi-eye me-2"></i> View Addon</span>
                </button>
              </li>
              <hr></hr>
              {renderOpenFolderMenu()}

              <li>
                <button
                  className="btn btn-link text-decoration-none p-2 w-100 d-flex justify-content-between"
                  onClick={onViewOnWarperia}
                >
                  <span><i className="bi bi-globe me-2"></i> View on Warperia</span>
                  <i className="bi bi-box-arrow-up-right"></i>
                </button>
              </li>
              {isInstalled && (
                <li>
                  {addonData?.custom_fields?.website_link ? (
                    <a
                      href={`${addonData.custom_fields.website_link}/issues`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn-link text-decoration-none p-2 w-100 d-flex justify-content-between"
                    >
                      <span><i className="bi bi-bug me-2"></i> Report Problems</span>
                      <i className="bi bi-box-arrow-up-right"></i>
                    </a>
                  ) : (
                    <button
                      className="btn btn-link text-decoration-none p-2 w-100 d-flex justify-content-between"
                      onClick={onReport}
                    >
                      <span><i className="bi bi-bug me-2"></i> Report Problems</span>
                    </button>
                  )}
                </li>
              )}
              {isInstalled && onDelete && (
                <>
                  <hr></hr>
                  <li>
                    <button
                      className="btn btn-link btn-delete text-decoration-none p-2 w-100 d-flex justify-content-between"
                      onClick={onDelete}
                    >
                      <span><i className="bi bi-trash me-2"></i> Delete Addon</span>
                    </button>
                  </li>
                </>
              )}
            </ul>
          </div>
        </div>
      </div>

      <SubMenuPortal />
    </>
  );
};

export default ContextMenu;
