import axios from 'axios';
import { WEB_URL } from './../../config.js';

const fetchAddons = async (expansion, page = 1, search = '', categories = [], pageSize = 20, orderby = 'installs', order = 'desc') => {
    try {
        const params = {
            search,
            page,
            per_page: pageSize,
            orderby,
            order,
        };

        if (categories.length > 0) {
            params.addon_category = categories.join(',');
        }

        const response = await axios.get(`${WEB_URL}/wp-json/wp/v2/${expansion}-addons`, { params });

        return {
            data: response.data,
            totalPages: parseInt(response.headers['x-wp-totalpages'], 10),
        };
    } catch (error) {
        console.error(`Error fetching ${expansion} addons:`, error);
        throw error;
    }
};

export default fetchAddons;