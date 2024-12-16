import axios from 'axios';
import { WEB_URL } from './../../config.js';

const cache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes in milliseconds
const cacheTimestamps = new Map();

function generateCacheKey(expansion, page, search, categories, pageSize, orderby, order) {
    return `${expansion}|${page}|${search}|${categories.join(',')}|${pageSize}|${orderby}|${order}`;
}

const fetchAddons = async (expansion, page = 1, search = '', categories = [], pageSize = 20, orderby = 'installs', order = 'desc') => {
    const cacheKey = generateCacheKey(expansion, page, search, categories, pageSize, orderby, order);

    // Check if we have a cached response and it's still valid
    if (cache.has(cacheKey)) {
        const cachedTime = cacheTimestamps.get(cacheKey);
        if (Date.now() - cachedTime < CACHE_TTL) {
            return cache.get(cacheKey);
        } else {
            // Cache expired, remove it
            cache.delete(cacheKey);
            cacheTimestamps.delete(cacheKey);
        }
    }

    try {
        const params = {
            search,
            page,
            per_page: pageSize,
            orderby,
            order
        };

        if (categories.length > 0) {
            params.addon_category = categories.join(',');
        }

        const response = await axios.get(`${WEB_URL}/wp-json/wp/v2/${expansion}-addons`, { params });
        const result = {
            data: response.data,
            totalPages: parseInt(response.headers['x-wp-totalpages'], 10),
        };

        // Store in cache
        cache.set(cacheKey, result);
        cacheTimestamps.set(cacheKey, Date.now());

        return result;
    } catch (error) {
        console.error(`Error fetching ${expansion} addons:`, error);
        throw error;
    }
};

export default fetchAddons;