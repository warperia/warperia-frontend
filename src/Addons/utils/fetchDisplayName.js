import axios from 'axios';
import { WEB_URL } from './config.js';

const fetchDisplayName = async (userId) => {
  try {
    const tokenResult = await window.electron.retrieveToken();
    if (tokenResult.success && tokenResult.token) {
      const response = await axios.get(
        `${WEB_URL}/wp-json/wp/v2/users/${userId}`,
        {
          headers: {
            Authorization: `Bearer ${tokenResult.token}`,
          },
        }
      );
      return response.data.name;
    } else {
      console.error("Failed to retrieve token.");
      return null;
    }
  } catch (error) {
    console.error("Error fetching display name:", error);
    return null;
  }
};

export default fetchDisplayName;