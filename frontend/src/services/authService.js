import axios from "axios";

const API_URL = "http://localhost:5000/api/auth";

export const registerUser = async (userData) => {
    const response = await axios.post(
        `${API_URL}/register`,
        userData
    );

    return response.data;
};

export const loginUser = async (userData) => {
    const response = await axios.post(
        `${API_URL}/login`,
        userData
    );

    return response.data;
};
export const getDatasets = async () => {
    const token = localStorage.getItem("token");

    const response = await axios.get(
        "http://localhost:5000/api/datasets",
        {
            headers: {
                Authorization: `Bearer ${token}`
            }
        }
    );

    return response.data;
};
export const uploadDataset = async (file, periodLabel, groupId) => {
    const token = localStorage.getItem("token");

    const formData = new FormData();

    formData.append("file", file);

    if (periodLabel) {
        formData.append("periodLabel", periodLabel);
    }

    if (groupId) {
        formData.append("groupId", groupId);
    }

    const response = await axios.post(
        "http://localhost:5000/api/datasets/upload",
        formData,
        {
            headers: {
                Authorization: `Bearer ${token}`
            }
        }
    );

    return response.data;
};
export const getDatasetById = async (id) => {
    const token = localStorage.getItem("token");

    const response = await axios.get(
        `http://localhost:5000/api/datasets/${id}`,
        {
            headers: {
                Authorization: `Bearer ${token}`
            }
        }
    );

    return response.data;
};
export const runQuery = async (datasetId, question) => {
    const token = localStorage.getItem("token");

    const response = await axios.post(
        "http://localhost:5000/api/queries",
        {
            datasetId,
            question
        },
        {
            headers: {
                Authorization: `Bearer ${token}`
            }
        }
    );

    return response.data;
};
export const getGroups = async () => {
    const token = localStorage.getItem("token");

    const response = await axios.get(
        "http://localhost:5000/api/groups",
        {
            headers: {
                Authorization: `Bearer ${token}`
            }
        }
    );

    return response.data;
};
export const getGroupTrends = async (groupId) => {
    const token = localStorage.getItem("token");

    const response = await axios.get(
        `http://localhost:5000/api/groups/${groupId}/trends`,
        {
            headers: {
                Authorization: `Bearer ${token}`
            }
        }
    );

    return response.data;
};
export const deleteDataset = async (id) => {
    const token = localStorage.getItem("token");

    const response = await axios.delete(
        `http://localhost:5000/api/datasets/${id}`,
        {
            headers: {
                Authorization: `Bearer ${token}`
            }
        }
    );

    return response.data;
};
export const getQueryHistory = async () => {
    const token = localStorage.getItem("token");

    const response = await axios.get(
        "http://localhost:5000/api/queries/history",
        {
            headers: {
                Authorization: `Bearer ${token}`
            }
        }
    );

    return response.data;
};
export const deleteGroup = async (groupId) => {
    const token = localStorage.getItem("token");

    const response = await axios.delete(
        `http://localhost:5000/api/groups/${groupId}`,
        {
            headers: {
                Authorization: `Bearer ${token}`
            }
        }
    );

    return response.data;
};
export const investigateDataset = async (id) => {
    const token = localStorage.getItem("token");

    const response = await axios.get(
        `http://localhost:5000/api/datasets/${id}/investigate`,
        {
            headers: {
                Authorization: `Bearer ${token}`
            }
        }
    );

    return response.data;
};
export const previewDatasetEdit = async (id, instruction) => {
    const token = localStorage.getItem("token");

    const response = await axios.post(
        `http://localhost:5000/api/datasets/${id}/edit/preview`,
        { instruction },
        {
            headers: {
                Authorization: `Bearer ${token}`
            }
        }
    );

    return response.data;
};

export const applyDatasetEdit = async (id, plan, instruction) => {
    const token = localStorage.getItem("token");

    const response = await axios.post(
        `http://localhost:5000/api/datasets/${id}/edit/apply`,
        { plan, instruction },
        {
            headers: {
                Authorization: `Bearer ${token}`
            }
        }
    );

    return response.data;
};

export const undoDatasetEdit = async (id) => {
    const token = localStorage.getItem("token");

    const response = await axios.post(
        `http://localhost:5000/api/datasets/${id}/edit/undo`,
        {},
        {
            headers: {
                Authorization: `Bearer ${token}`
            }
        }
    );

    return response.data;
};
export const suggestJoinKey = async (datasetAId, datasetBId) => {
    const token = localStorage.getItem("token");

    const response = await axios.post(
        "http://localhost:5000/api/datasets/join/suggest",
        { datasetAId, datasetBId },
        {
            headers: {
                Authorization: `Bearer ${token}`
            }
        }
    );

    return response.data;
};

export const joinDatasets = async (datasetAId, datasetBId, columnA, columnB) => {
    const token = localStorage.getItem("token");

    const response = await axios.post(
        "http://localhost:5000/api/datasets/join",
        { datasetAId, datasetBId, columnA, columnB },
        {
            headers: {
                Authorization: `Bearer ${token}`
            }
        }
    );

    return response.data;
};