import React, { useEffect, useState } from 'react';

const ContextMenu = ({ xPos, yPos, onReinstall, onDelete, onViewAddon, onReport, visible, isInstalled, addonImage, addonName, addonData}) => {
  const [adjustedX, setAdjustedX] = useState(xPos);
  const [adjustedY, setAdjustedY] = useState(yPos);

  useEffect(() => {
    if (visible) {
      const contextMenu = document.querySelector('.context-menu');
      if (contextMenu) {
        const menuWidth = contextMenu.offsetWidth;
        const menuHeight = contextMenu.offsetHeight;
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        
        let newX = xPos;
        let newY = yPos;

        if (xPos + menuWidth > viewportWidth) {
          newX = viewportWidth - menuWidth - 10;
        }

        if (yPos + menuHeight > viewportHeight) {
          newY = viewportHeight - menuHeight - 10;
        }

        setAdjustedX(newX);
        setAdjustedY(newY);
      }
    }
  }, [xPos, yPos, visible]);

  return (
    <div
      className="context-menu w-100 bg-dark"
      style={{
        top: adjustedY,
        left: adjustedX,
        display: visible ? 'block' : 'none',
        position: 'absolute',
        zIndex: 1000,
      }}
    >
      <div className="d-flex flex-column align-items-center">
        <div className="d-flex align-items-center gap-3 context-menu-top w-100 p-2">
          <img src={addonImage} alt={addonName} className="img-fluid rounded" />
          <div className="addon-name text-light fw-medium">{addonName}</div>
        </div>
        <div className="context-menu-bottom w-100">
          <ul className="list-unstyled m-0">
            <li>
              <button className="btn btn-link text-decoration-none p-2 w-100 d-flex justify-content-between" onClick={() => onViewAddon(addonData)}>
                <span>Preview</span>
                <i className="bi bi-eye"></i>
              </button>
            </li>
            {isInstalled && onReinstall && (
              <li>
                <button className="btn btn-link text-decoration-none p-2 w-100 d-flex justify-content-between" onClick={onReinstall}>
                  <span>Reinstall</span>
                  <i className="bi bi-arrow-clockwise"></i>
                </button>
              </li>
            )}
            <li>
              <button className="btn btn-link text-decoration-none p-2 w-100 d-flex justify-content-between" onClick={onReport}>
                <span>Report</span>
                <i className="bi bi-flag"></i>
              </button>
            </li>
            {isInstalled && onDelete && (
              <li>
                <button className="btn btn-link btn-delete text-decoration-none p-2 w-100 d-flex justify-content-between" onClick={onDelete}>
                  <span>Delete</span>
                  <i className="bi bi-trash"></i>
                </button>
              </li>
            )}
          </ul>
        </div>
      </div>
    </div>
  );
};

export default ContextMenu;