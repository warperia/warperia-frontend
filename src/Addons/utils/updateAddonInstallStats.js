import axios from 'axios';
import { WEB_URL } from './../../config.js';

const updateAddonInstallStats = async (addonId, postType) => {
  if (!postType) {
    return;
  }

  try {
    const response = await axios.post(
      `${WEB_URL}/wp-admin/admin-ajax.php`,
      new URLSearchParams({
        action: 'increment_addon_install',
        addon_id: addonId,
        post_type: postType,
      }),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      }
    );
    
    if (response.data.success) {
    } else {
    }

  } catch (error) {
  }
};

export default updateAddonInstallStats;
