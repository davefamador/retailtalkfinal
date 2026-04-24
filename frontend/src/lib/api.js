/**
 * API client — all backend calls go through here.
 * Includes 10-second timeout and proper error handling.
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
const TIMEOUT_MS = 10000; // 10 second timeout

function getToken() {
    if (typeof window !== 'undefined') {
        return localStorage.getItem('retailtalk_token');
    }
    return null;
}

export function setToken(token) {
    localStorage.setItem('retailtalk_token', token);
}

export function removeToken() {
    localStorage.removeItem('retailtalk_token');
}

export function getStoredUser() {
    if (typeof window !== 'undefined') {
        const data = localStorage.getItem('retailtalk_user');
        return data ? JSON.parse(data) : null;
    }
    return null;
}

export function setStoredUser(user) {
    localStorage.setItem('retailtalk_user', JSON.stringify(user));
}

async function apiFetch(path, options = {}) {
    const token = getToken();
    const headers = {
        'Content-Type': 'application/json',
        ...(token && { Authorization: `Bearer ${token}` }),
        ...options.headers,
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

    let res;
    try {
        res = await fetch(`${API_URL}${path}`, {
            ...options,
            headers,
            signal: controller.signal,
        });
    } catch (err) {
        clearTimeout(timeoutId);
        if (err.name === 'AbortError') {
            throw new Error('Request timed out after 10 seconds. Please check your connection and try again.');
        }
        throw new Error('Network error: Cannot connect to the server. Make sure the backend is running.');
    } finally {
        clearTimeout(timeoutId);
    }

    if (!res.ok) {
        if (res.status === 401) {
            localStorage.removeItem('retailtalk_token');
            localStorage.removeItem('retailtalk_user');
            if (typeof window !== 'undefined') {
                window.location.href = '/login';
            }
            throw new Error('Session expired. Please log in again.');
        }
        let detail = `API error ${res.status}`;
        try {
            const error = await res.json();
            detail = error.detail || detail;
        } catch {
            // Response body was empty or not JSON
            const text = await res.text().catch(() => '');
            if (text) detail = text;
        }
        throw new Error(detail);
    }

    return res.json();
}

// --- Auth ---
export async function register(email, password, fullName, role = 'buyer') {
    const data = await apiFetch('/auth/register', {
        method: 'POST',
        body: JSON.stringify({ email, password, full_name: fullName, role }),
    });
    setToken(data.access_token);
    setStoredUser(data.user);
    return data;
}

export async function login(email, password) {
    const data = await apiFetch('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
    });
    setToken(data.access_token);
    setStoredUser(data.user);
    return data;
}

export async function getMe() {
    return apiFetch('/auth/me');
}

export function logout() {
    removeToken();
    localStorage.removeItem('retailtalk_user');
}

// --- Products ---
export async function createProduct(product) {
    return apiFetch('/products/', {
        method: 'POST',
        body: JSON.stringify(product),
    });
}

export async function listProducts(limit = 50) {
    return apiFetch(`/products/?limit=${limit}`);
}

export async function getMyProducts() {
    return apiFetch('/products/my');
}

export async function getProduct(id) {
    return apiFetch(`/products/${id}`);
}

export async function updateProduct(id, data) {
    return apiFetch(`/products/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
    });
}

export async function deleteProduct(id) {
    return apiFetch(`/products/${id}`, { method: 'DELETE' });
}

/**
 * Upload a product image file to Supabase Storage.
 * Returns { url, filename }.
 */
export async function uploadProductImage(file) {
    const token = getToken();
    const formData = new FormData();
    formData.append('file', file);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s for uploads

    let res;
    try {
        res = await fetch(`${API_URL}/products/upload-image`, {
            method: 'POST',
            headers: {
                ...(token && { Authorization: `Bearer ${token}` }),
            },
            body: formData,
            signal: controller.signal,
        });
    } catch (err) {
        clearTimeout(timeoutId);
        if (err.name === 'AbortError') {
            throw new Error('Image upload timed out. Try a smaller file.');
        }
        throw new Error('Network error during upload.');
    } finally {
        clearTimeout(timeoutId);
    }

    if (!res.ok) {
        const error = await res.json().catch(() => ({ detail: 'Upload failed' }));
        throw new Error(error.detail || `Upload error ${res.status}`);
    }

    return res.json();
}

// --- Search (ML-powered!) ---
export async function searchProducts(query, maxResults = 20, showAll = false) {
    // Log the prompt asynchronously (don't block the search)
    fetch(`${API_URL}/insights/prompts`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            ...(getToken() && { Authorization: `Bearer ${getToken()}` }),
        },
        body: JSON.stringify({ prompt: query }),
    }).catch(console.error);

    const params = `q=${encodeURIComponent(query)}&max_results=${maxResults}${showAll ? '&show_all=true' : ''}`;
    return apiFetch(`/search/?${params}`);
}

// --- Insights ---
export async function getBuyerInsights() {
    return apiFetch('/insights/buyer');
}

export async function getSellerInsights() {
    return apiFetch('/insights/seller');
}

export async function getBuyerRecommendations() {
    return apiFetch('/insights/buyer/recommendations');
}

// --- Transactions ---
export async function buyProduct(productId, quantity = 1) {
    return apiFetch('/transactions/buy', {
        method: 'POST',
        body: JSON.stringify({ product_id: productId, quantity }),
    });
}

export async function getTransactionHistory() {
    return apiFetch('/transactions/history');
}

export async function getBalance() {
    return apiFetch('/transactions/balance');
}

export async function topUp(amount) {
    return apiFetch('/transactions/topup', {
        method: 'POST',
        body: JSON.stringify({ amount }),
    });
}

export async function withdraw(amount) {
    return apiFetch('/transactions/withdraw', {
        method: 'POST',
        body: JSON.stringify({ amount }),
    });
}

export async function deposit(amount) {
    return apiFetch('/transactions/topup', {
        method: 'POST',
        body: JSON.stringify({ amount }),
    });
}

export async function getSVFHistory() {
    return apiFetch('/transactions/svf-history');
}

// --- Admin ---
export async function adminLogin(email, password) {
    const data = await apiFetch('/auth/admin/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
    });
    setToken(data.access_token);
    localStorage.setItem('retailtalk_admin', JSON.stringify(data.user));
    return data;
}

export async function adminRegister(email, password, fullName) {
    const data = await apiFetch('/auth/admin/register', {
        method: 'POST',
        body: JSON.stringify({ email, password, full_name: fullName }),
    });
    setToken(data.access_token);
    localStorage.setItem('retailtalk_admin', JSON.stringify(data.user));
    return data;
}

export function getStoredAdmin() {
    if (typeof window !== 'undefined') {
        const data = localStorage.getItem('retailtalk_admin');
        return data ? JSON.parse(data) : null;
    }
    return null;
}

export function adminLogout() {
    removeToken();
    localStorage.removeItem('retailtalk_admin');
}

export async function adminGetDashboard() {
    return apiFetch('/admin/dashboard');
}

export async function adminGetUsers(search = '', role = '', departmentId = '') {
    let url = `/admin/users?search=${encodeURIComponent(search)}`;
    if (role) url += `&role=${encodeURIComponent(role)}`;
    if (departmentId) url += `&department_id=${encodeURIComponent(departmentId)}`;
    return apiFetch(url);
}

export async function adminBanUser(userId, isBanned) {
    return apiFetch(`/admin/users/${userId}/ban`, {
        method: 'PUT',
        body: JSON.stringify({ is_banned: isBanned }),
    });
}

export async function adminDeleteUser(userId) {
    return apiFetch(`/admin/users/${userId}`, { method: 'DELETE' });
}

export async function adminUpdateUserDepartment(userId, departmentId) {
    return apiFetch(`/admin/users/${userId}/department`, {
        method: 'PUT',
        body: JSON.stringify({ department_id: departmentId || null }),
    });
}

export async function adminGetTransactions(search = '', type = '', status = '', dateRange = '', specificDate = '') {
    let url = `/admin/transactions?search=${encodeURIComponent(search)}`;
    if (type) url += `&txn_type=${encodeURIComponent(type)}`;
    if (status) url += `&status=${encodeURIComponent(status)}`;
    if (dateRange) url += `&date_range=${encodeURIComponent(dateRange)}`;
    if (specificDate) url += `&specific_date=${encodeURIComponent(specificDate)}`;
    return apiFetch(url);
}

export async function adminGetReports() {
    return apiFetch('/admin/reports');
}

export async function adminGetProducts(search = '') {
    return apiFetch(`/admin/products?search=${encodeURIComponent(search)}`);
}

export async function adminUpdateProduct(productId, data) {
    return apiFetch(`/admin/products/${productId}`, {
        method: 'PUT',
        body: JSON.stringify(data),
    });
}

export async function adminDeleteProduct(productId) {
    return apiFetch(`/admin/products/${productId}`, { method: 'DELETE' });
}

export async function adminGetUserDetail(userId) {
    return apiFetch(`/admin/users/${userId}/detail`);
}

export async function adminApproveOrder(transactionId) {
    return apiFetch(`/admin/transactions/${transactionId}/status`, { method: 'PUT' });
}

export async function adminRegisterDelivery(fullName, email, password, contactNumber) {
    return apiFetch('/admin/delivery/register', {
        method: 'POST',
        body: JSON.stringify({ full_name: fullName, email, password, contact_number: contactNumber }),
    });
}

// --- Contacts ---
export async function getMyContact() {
    return apiFetch('/contacts/me');
}

export async function setMyContact(contactNumber, deliveryAddress) {
    const payload = { contact_number: contactNumber };
    if (deliveryAddress !== undefined) payload.delivery_address = deliveryAddress;
    return apiFetch('/contacts/me', {
        method: 'PUT',
        body: JSON.stringify(payload),
    });
}

// --- Cart ---
export async function getCart() {
    return apiFetch('/cart/');
}

export async function addToCart(productId, quantity = 1) {
    return apiFetch('/cart/add', {
        method: 'POST',
        body: JSON.stringify({ product_id: productId, quantity }),
    });
}

export async function updateCartItem(productId, quantity) {
    return apiFetch('/cart/update', {
        method: 'PUT',
        body: JSON.stringify({ product_id: productId, quantity }),
    });
}

export async function removeFromCart(productId) {
    return apiFetch(`/cart/remove/${productId}`, { method: 'DELETE' });
}

export async function clearCart() {
    return apiFetch('/cart/clear', { method: 'DELETE' });
}

export async function checkoutCart() {
    return apiFetch('/cart/checkout', {
        method: 'POST',
        body: JSON.stringify({}),
    });
}

// --- Delivery ---
export async function getAvailableOrders() {
    return apiFetch('/delivery/available');
}

export async function getActiveDeliveries() {
    return apiFetch('/delivery/active');
}

export async function pickOrder(transactionId) {
    return apiFetch(`/delivery/pick/${transactionId}`, { method: 'POST' });
}

export async function updateDeliveryStatus(transactionId, status) {
    return apiFetch(`/delivery/status/${transactionId}`, {
        method: 'PUT',
        body: JSON.stringify({ status }),
    });
}

export async function getDeliveryEarnings() {
    return apiFetch('/delivery/earnings');
}

export async function getDeliveryHistory() {
    return apiFetch('/delivery/history');
}

export async function deliveryWithdraw(amount) {
    return apiFetch('/delivery/withdraw', {
        method: 'POST',
        body: JSON.stringify({ amount }),
    });
}

// --- Pending Products (Admin) ---
export async function adminGetPendingProducts() {
    return apiFetch('/admin/pending-products');
}

export async function adminApproveProduct(productId) {
    return apiFetch(`/admin/products/${productId}/approve`, { method: 'PUT' });
}

export async function adminUnapproveProduct(productId) {
    return apiFetch(`/admin/products/${productId}/unapprove`, { method: 'PUT' });
}

// --- Profile ---
export async function getProfile() {
    return apiFetch('/auth/profile');
}

export async function updateProfile(data) {
    return apiFetch('/auth/profile', {
        method: 'PUT',
        body: JSON.stringify(data),
    });
}

// --- Admin: Departments ---
export async function adminGetDepartments() {
    return apiFetch('/admin/departments');
}

export async function adminGetDepartmentDetail(deptId) {
    return apiFetch(`/admin/departments/${deptId}`);
}

export async function adminCreateDepartment(data) {
    return apiFetch('/admin/departments', {
        method: 'POST',
        body: JSON.stringify(data),
    });
}

export async function adminUpdateDepartment(deptId, data) {
    return apiFetch(`/admin/departments/${deptId}`, {
        method: 'PUT',
        body: JSON.stringify(data),
    });
}

export async function adminDeleteDepartment(deptId) {
    return apiFetch(`/admin/departments/${deptId}`, { method: 'DELETE' });
}

// --- Admin: Product Removal Approval ---
export async function adminGetPendingRemovals() {
    return apiFetch('/admin/pending-removals');
}

export async function adminApproveRemoval(productId) {
    return apiFetch(`/admin/products/${productId}/approve-removal`, { method: 'PUT' });
}

export async function adminRejectRemoval(productId) {
    return apiFetch(`/admin/products/${productId}/reject-removal`, { method: 'PUT' });
}

// --- Admin: Deliveries Management ---
export async function adminGetDeliveriesStats() {
    return apiFetch('/admin/deliveries/stats');
}

// --- Admin: Restock Requests ---
export async function adminCreateRestockRequest(data) {
    return apiFetch('/admin/restock-request', {
        method: 'POST',
        body: JSON.stringify(data),
    });
}

export async function adminGetRestockRequests(departmentId = '', status = '') {
    let url = '/admin/restock-requests?';
    if (departmentId) url += `department_id=${encodeURIComponent(departmentId)}&`;
    if (status) url += `status=${encodeURIComponent(status)}&`;
    return apiFetch(url);
}

// --- Buyer: Cancel Order (group-level) ---
export async function cancelOrder(groupId) {
    return apiFetch(`/transactions/buyer/cancel/${groupId}`, { method: 'PUT' });
}

// --- Manager: Product Removal Request ---
export async function managerRequestProductRemoval(productId) {
    return apiFetch(`/manager/products/${productId}/request-removal`, { method: 'POST' });
}

// --- Admin: Manager Registration ---
export async function adminRegisterManager(data) {
    return apiFetch('/admin/managers/register', {
        method: 'POST',
        body: JSON.stringify(data),
    });
}

// --- Manager Dashboard ---
export async function managerGetDashboard() {
    return apiFetch('/manager/dashboard');
}

export async function managerGetStaff(search = '') {
    return apiFetch(`/manager/staff?search=${encodeURIComponent(search)}`);
}

export async function adminRegisterStaff(data) {
    return apiFetch('/admin/staff/register', {
        method: 'POST',
        body: JSON.stringify(data),
    });
}

export async function managerRegisterStaff(data) {
    return apiFetch('/manager/staff/register', {
        method: 'POST',
        body: JSON.stringify(data),
    });
}

export async function managerGetStaffDetail(userId) {
    return apiFetch(`/manager/staff/${userId}/detail`);
}

export async function managerRemoveStaff(userId) {
    return apiFetch(`/manager/staff/${userId}/remove`, { method: 'DELETE' });
}

export async function managerGetRestockRequests(status = 'pending_manager') {
    const q = status ? `?status=${encodeURIComponent(status)}` : '';
    return apiFetch(`/manager/restock-requests${q}`);
}

export async function managerApproveRestock(requestId, data = {}) {
    return apiFetch(`/manager/restock-requests/${requestId}/approve`, {
        method: 'PUT',
        body: JSON.stringify(data),
    });
}

export async function managerRejectRestock(requestId, data = {}) {
    return apiFetch(`/manager/restock-requests/${requestId}/reject`, {
        method: 'PUT',
        body: JSON.stringify(data),
    });
}

export async function managerCancelRestock(requestId, data = {}) {
    return apiFetch(`/manager/restock-requests/${requestId}/cancel`, {
        method: 'PUT',
        body: JSON.stringify(data),
    });
}

export async function adminCancelRestock(requestId, data = {}) {
    return apiFetch(`/admin/restock-requests/${requestId}/cancel`, {
        method: 'PUT',
        body: JSON.stringify(data),
    });
}

export async function managerGetProducts(search = '') {
    const q = search ? `?search=${encodeURIComponent(search)}` : '';
    return apiFetch(`/manager/products${q}`);
}

export async function managerUpdateProduct(productId, data) {
    return apiFetch(`/manager/products/${productId}`, {
        method: 'PUT',
        body: JSON.stringify(data),
    });
}

export async function managerGetTransactions(search = '') {
    const q = search ? `?search=${encodeURIComponent(search)}` : '';
    return apiFetch(`/manager/transactions${q}`);
}

// --- Restock (Staff) ---
export async function createRestockRequest(data) {
    return apiFetch('/restock/request', {
        method: 'POST',
        body: JSON.stringify(data),
    });
}

export async function getMyRestockRequests() {
    return apiFetch('/restock/my-requests');
}

// --- Restock (Delivery) ---
export async function getRestockDeliveryQueue() {
    return apiFetch('/restock/delivery-queue');
}

export async function acceptRestockDelivery(requestId) {
    return apiFetch(`/restock/${requestId}/accept`, { method: 'POST' });
}

export async function modifyRestockDelivery(requestId, data) {
    return apiFetch(`/restock/${requestId}/modify`, {
        method: 'PUT',
        body: JSON.stringify(data),
    });
}

export async function completeRestockDelivery(requestId) {
    return apiFetch(`/restock/${requestId}/deliver`, { method: 'PUT' });
}

export async function getActiveRestockDeliveries() {
    return apiFetch('/restock/active-deliveries');
}

export async function getRestockDeliveryHistory() {
    return apiFetch('/restock/delivery-history');
}

// --- Delivery Orders (Staff/Manager) ---
export async function getStaffDeliveryOrders() {
    return apiFetch('/transactions/staff/delivery-orders');
}

export async function updateDeliveryOrderStatus(transactionId, status) {
    return apiFetch(`/transactions/staff/delivery-orders/${transactionId}/status`, {
        method: 'PUT',
        body: JSON.stringify({ status }),
    });
}

export async function getManagerDeliveryOrders() {
    return apiFetch('/transactions/manager/delivery-orders');
}

export async function managerUpdateDeliveryOrderStatus(transactionId, status) {
    return apiFetch(`/transactions/manager/delivery-orders/${transactionId}/status`, {
        method: 'PUT',
        body: JSON.stringify({ status }),
    });
}


// --- Manager Reassign ---
export async function managerReassignOrder(transactionId, staffId) {
    return apiFetch(`/transactions/manager/reassign/${transactionId}`, {
        method: 'PUT',
        body: JSON.stringify({ staff_id: staffId }),
    });
}

export async function managerRestockDirect(productId, quantity, notes = '') {
    return apiFetch('/manager/restock-direct', {
        method: 'POST',
        body: JSON.stringify({ product_id: productId, quantity, notes }),
    });
}

export async function managerChangeStaffPassword(userId, newPassword) {
    return apiFetch(`/manager/staff/${userId}/change-password`, {
        method: 'PUT',
        body: JSON.stringify({ new_password: newPassword }),
    });
}

export async function adminChangeUserPassword(userId, newPassword) {
    return apiFetch(`/admin/users/${userId}/change-password`, {
        method: 'PUT',
        body: JSON.stringify({ new_password: newPassword }),
    });
}

// --- Admin Create Product for Department ---
export async function adminCreateProductForDept(deptId, product) {
    return apiFetch(`/admin/departments/${deptId}/products`, {
        method: 'POST',
        body: JSON.stringify(product),
    });
}

// --- Wishlist ---
export async function getWishlist() {
    return apiFetch('/wishlist/');
}

export async function addToWishlist(productId) {
    return apiFetch('/wishlist/add', {
        method: 'POST',
        body: JSON.stringify({ product_id: productId }),
    });
}

export async function removeFromWishlist(productId) {
    return apiFetch(`/wishlist/remove/${productId}`, { method: 'DELETE' });
}

export async function checkWishlist(productId) {
    return apiFetch(`/wishlist/check/${productId}`);
}

export async function getSellerWishlistReport() {
    return apiFetch('/wishlist/seller-report');
}

export async function getAdminWishlistReport() {
    return apiFetch('/wishlist/admin-report');
}

// --- Salary Management ---
export async function adminGetSalaries() {
    return apiFetch('/admin/salaries');
}

export async function adminSetSalary(userId, salary) {
    return apiFetch(`/admin/salaries/set/${userId}`, {
        method: 'PUT',
        body: JSON.stringify({ salary }),
    });
}

export async function adminPayAll() {
    return apiFetch('/admin/salaries/pay-all', { method: 'POST' });
}

export async function adminPayStore(departmentId) {
    return apiFetch(`/admin/salaries/pay-store/${departmentId}`, { method: 'POST' });
}

export async function adminPayIndividual(recipientId, amount) {
    return apiFetch('/admin/salaries/pay-individual', {
        method: 'POST',
        body: JSON.stringify({ recipient_id: recipientId, amount }),
    });
}

export async function getSalaryHistory() {
    return apiFetch('/transactions/salary-history');
}
