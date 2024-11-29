import React from 'react';

const ContextMenu = ({ xPos, yPos, onReinstall, onDelete, onViewAddon, visible }) => {
  return (
    <div
      className="context-menu"
      style={{ top: yPos, left: xPos, display: visible ? 'block' : 'none', position: 'absolute', zIndex: 1000 }}
    >
      <ul className="list-unstyled m-0">
      <li>
          <button className="btn btn-link text-decoration-none p-2 w-100 text-start" onClick={onViewAddon}>
            <i className="bi bi-eye"></i> View Addon
          </button>
        </li>
        {onReinstall && (
          <li>
            <button className="btn btn-link text-decoration-none p-2 w-100 text-start" onClick={onReinstall}>
              <i className="bi bi-arrow-clockwise"></i> Reinstall Addon
            </button>
          </li>
        )}
        {onDelete && (
          <li>
            <button className="btn btn-link text-decoration-none p-2 w-100 text-start text-danger" onClick={onDelete}>
              <i className="bi bi-trash"></i> Delete Addon
            </button>
          </li>
        )}
      </ul>
    </div>
  );
};

export default ContextMenu;
