import axios from 'axios';
import { WEB_URL } from './../../config.js';

const updateAddonUninstallStats = async (addonId, postType) => {
  try {
    const response = await axios.post(
      `${WEB_URL}/wp-admin/admin-ajax.php`,
      new URLSearchParams({
        action: 'increment_addon_uninstall',
        addon_id: addonId,
        post_type: postType,
      }),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      }
    );

  } catch (error) {
    console.error(`Error updating uninstall stats for addon ${addonId}:`, error);
  }
};

export default updateAddonUninstallStats;