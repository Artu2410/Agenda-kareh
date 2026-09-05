import { API_BASE_URL } from './apiBase';
import * as authStore from '../stores/auth';

const isUploadPath = (url) => url.pathname === '/uploads' || url.pathname.startsWith('/uploads/');

export const getAuthenticatedFileUrl = (value = '') => {
  const rawUrl = String(value || '').trim();
  if (!rawUrl || rawUrl.startsWith('data:') || rawUrl.startsWith('blob:')) return rawUrl;

  let fileUrl;
  try {
    fileUrl = new URL(rawUrl, `${API_BASE_URL}/`);
  } catch {
    return rawUrl;
  }

  const apiOrigin = new URL(API_BASE_URL).origin;
  if (fileUrl.origin !== apiOrigin || !isUploadPath(fileUrl)) return rawUrl;

  const token = authStore.getAccessToken();
  if (token) fileUrl.searchParams.set('token', token);
  return fileUrl.toString();
};
