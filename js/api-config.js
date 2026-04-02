/**
 * API Configuration
 * Centralized endpoint management for frontend
 * Change the API_BASE_URL based on environment
 */

// Detect environment
const isDevelopment =
    window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1' ||
    window.location.protocol === 'file:';
const isProduction = !isDevelopment;

// API Configuration
const API_CONFIG = {
    // Use HTTPS in production
    baseURL: isDevelopment
        ? 'http://localhost:5000'
        : 'https://insidelautech.onrender.com',

    // API endpoints
    endpoints: {
        auth: {
            signup: '/api/auth/signup',
            login: '/api/auth/login',
            logout: '/api/auth/logout',
            verify: '/api/auth/verify',
            resendVerification: '/api/auth/resend-verification',
            forgotPassword: '/api/auth/forgot-password',
            resetPassword: '/api/auth/reset-password',
            me: '/api/auth/me',
        },
        products: {
            list: '/api/products',
            getOne: '/api/products/{id}',
            create: '/api/products',
            update: '/api/products/{id}',
            delete: '/api/products/{id}',
        },
        orders: {
            list: '/api/orders',
            getOne: '/api/orders/{id}',
            create: '/api/orders',
        },
        cart: {
            get: '/api/cart',
            upsert: '/api/cart',
        },
    },

    // Timeout for requests (ms)
    timeout: 10000,

    // Get full URL for an endpoint
    getUrl: (endpoint) => {
        return `${API_CONFIG.baseURL}${endpoint}`;
    },
};

// Helper function to make authenticated API requests
async function makeApiRequest(endpoint, options = {}) {
    const {
        method = 'GET',
        body = null,
        headers = {},
        includeAuth = true,
    } = options;

    const url = API_CONFIG.getUrl(endpoint);

    // Prepare headers
    const finalHeaders = {
        'Content-Type': 'application/json',
        ...headers,
    };

    if (includeAuth) {
        const authToken = localStorage.getItem('shoponcampus_auth_token');
        if (authToken) {
            finalHeaders.Authorization = `Bearer ${authToken}`;
        }
    }

    // Prepare request config
    const requestConfig = {
        method,
        headers: finalHeaders,
        credentials: 'include',
    };

    if (body && method !== 'GET') {
        requestConfig.body = JSON.stringify(body);
    }

    try {
        const response = await fetch(url, requestConfig);
        const contentType = response.headers.get('content-type') || '';
        const isJson = contentType.includes('application/json');
        const data = isJson
            ? await response.json()
            : { error: await response.text() };

        if (!response.ok) {
            const error = new Error(data.error || 'API request failed');
            error.status = response.status;
            error.data = data;
            throw error;
        }

        return data;
    } catch (error) {
        // Log error but don't expose sensitive details to user
        console.error('API request error:', error);
        throw error;
    }
}

if (typeof window !== 'undefined') {
    window.API_CONFIG = API_CONFIG;
    window.makeApiRequest = makeApiRequest;
}

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { API_CONFIG, makeApiRequest };
}
