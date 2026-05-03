import axios from "axios";

export const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API = `${BACKEND_URL}/api`;

export const api = axios.create({ baseURL: API });

api.interceptors.request.use((config) => {
    const token = localStorage.getItem("rurapp_token");
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

export const setToken = (token) => {
    if (token) localStorage.setItem("rurapp_token", token);
    else localStorage.removeItem("rurapp_token");
};

export const getToken = () => localStorage.getItem("rurapp_token");
