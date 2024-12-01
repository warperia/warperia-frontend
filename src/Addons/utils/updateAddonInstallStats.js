import axios from 'axios';
import { WEB_URL } from './../../config.js';

const updateAddonInstallStats = async (addonId, postType) => {
  if (!addonId || !postType) {
    return;
  }

  try {
    const response = await axios.post(
      `${WEB_URL}/wp-admin/admin-ajax.php`,
      new URLSearchParams({
        action: 'increment_addon_download',
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
      // console.log(`Successfully updated download stats for addon ID: ${addonId}`);
    } else {
      // console.error(`Failed to update download stats: ${response.data.data?.message || 'Unknown error'}`);
    }
  } catch (error) {
    // console.error("Error incrementing addon install stats:", error);
  }
};
export default updateAddonInstallStats;
