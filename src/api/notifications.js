// === api/notifications.js ===
// User-facing notification API wrappers.

import { API } from './index'

export const getNotifications     = ()   => API.get('/api/notifications')
export const markNotificationRead = (id) => API.post(`/api/notifications/${id}/read`)
export const markAllNotificationsRead = () => API.post('/api/notifications/read-all')
