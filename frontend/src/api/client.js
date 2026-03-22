import axios from 'axios';

const TOKEN_STORAGE_KEY = 'pizzeria_pos_token';

const client = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8000/api',
  timeout: 12000,
});

export function getAuthToken() {
  return localStorage.getItem(TOKEN_STORAGE_KEY);
}

export function setAuthToken(token) {
  if (token) {
    localStorage.setItem(TOKEN_STORAGE_KEY, token);
    client.defaults.headers.common.Authorization = `Token ${token}`;
    return;
  }

  localStorage.removeItem(TOKEN_STORAGE_KEY);
  delete client.defaults.headers.common.Authorization;
}

const initialToken = getAuthToken();
if (initialToken) {
  client.defaults.headers.common.Authorization = `Token ${initialToken}`;
}

export default client;
