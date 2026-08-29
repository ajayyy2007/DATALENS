import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
    getDatasets,
    uploadDataset,
    getGroups,
    deleteDataset,
    deleteGroup
} from "../services/authService";
function Dashboard() {
    const navigate = useNavigate();

    const user = JSON.parse(localStorage.getItem("user"));

    const [datasets, setDatasets] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [selectedFile, setSelectedFile] = useState(null);
    const [periodLabel, setPeriodLabel] = useState("");
    const [selectedGroupId, setSelectedGroupId] = useState("");
    const [uploading, setUploading] = useState(false);
    const [uploadMessage, setUploadMessage] = useState("");

    const [groups, setGroups] = useState([]);
    const [groupsLoading, setGroupsLoading] = useState(true);

    const handleLogout = () => {
        localStorage.removeItem("token");
        localStorage.removeItem("user");

        navigate("/login");
    };
    const handleFileChange = (e) => {
    const file = e.target.files[0];

    if (!file) {
        return;
    }

    if (!file.name.toLowerCase().endsWith(".csv")) {
        setUploadMessage("Please select a CSV file.");
        setSelectedFile(null);
        return;
    }

    setSelectedFile(file);
    setUploadMessage("");
};
const handleUpload = async () => {
    if (!selectedFile) {
        setUploadMessage("Please select a CSV file first.");
        return;
    }

    try {
        setUploading(true);
        setUploadMessage("");

        const data = await uploadDataset(
            selectedFile,
            periodLabel,
            selectedGroupId || null
        );

        setUploadMessage(data.message);

        setSelectedFile(null);
        setPeriodLabel("");
        setSelectedGroupId("");

        const updatedData = await getDatasets();

        setDatasets(updatedData.datasets);

        const updatedGroups = await getGroups();
        setGroups(updatedGroups.groups);

    } catch (error) {
        setUploadMessage(
            error.response?.data?.message ||
            "Upload failed"
        );
    } finally {
        setUploading(false);
    }
};
const handleDelete = async (id, e) => {
    e.stopPropagation();
    if (!window.confirm("Delete this dataset? This cannot be undone.")) return;

    try {
        await deleteDataset(id);
        const updatedData = await getDatasets();
        setDatasets(updatedData.datasets);
    } catch (error) {
        alert(error.response?.data?.message || "Failed to delete dataset");
    }
};

const handleDeleteGroup = async (groupId, e) => {
    e.stopPropagation();
    if (!window.confirm("Delete this group and ALL datasets inside it? This cannot be undone.")) return;

    try {
        await deleteGroup(groupId);
        const updatedGroups = await getGroups();
        setGroups(updatedGroups.groups);
        const updatedData = await getDatasets();
        setDatasets(updatedData.datasets);
    } catch (error) {
        alert(error.response?.data?.message || "Failed to delete group");
    }
};

    useEffect(() => {
        const loadDatasets = async () => {
            try {
                const data = await getDatasets();
                setDatasets(data.datasets);
            } catch (error) {
                setError("Failed to load datasets");
            } finally {
                setLoading(false);
            }
        };

        const loadGroups = async () => {
            try {
                const data = await getGroups();
                setGroups(data.groups);
            } catch (error) {
                // non-fatal, groups are a secondary feature
            } finally {
                setGroupsLoading(false);
            }
        };

        loadDatasets();
        loadGroups();
    }, []);

    return (
        <div className="dashboard">

            <aside className="sidebar">

                <div className="sidebar-logo">
                    DataLens
                </div>

                <div className="sidebar-item active">
                    Dashboard
                </div>

                <div
                    className="sidebar-item"
                    onClick={() => navigate("/datasets")}
                >
                    Datasets
                </div>

              <div
    className="sidebar-item"
    onClick={() => navigate("/query")}
>
    Query Workspace
</div>
<div
    className="sidebar-item"
    onClick={() => navigate("/join")}
>
    Join Datasets
</div>

                <div
                    className="sidebar-item"
                    onClick={() => navigate("/query-history")}
                >
                    Query History
                </div>

            </aside>

            <main className="main-content">

                <div className="dashboard-header">

                    <div>
                        <h1>Dashboard</h1>

                        <p>
                            Welcome back, {user?.name}
                        </p>
                    </div>

                    <button
                        className="logout-btn"
                        onClick={handleLogout}
                    >
                        Logout
                    </button>

                </div>
                <div className="upload-section">

    <div>
        <h2>Upload Dataset</h2>

        <p>
            Upload a CSV file to start analyzing your data. If this is a recurring
            dataset (e.g. monthly sales), give it a period label and choose whether
            it belongs to an existing group or starts a new one.
        </p>
    </div>

    <div className="upload-controls">

        <input
            type="file"
            accept=".csv"
            onChange={handleFileChange}
        />

        <input
            type="text"
            placeholder="Period (e.g. January 2026) — optional"
            value={periodLabel}
            onChange={(e) => setPeriodLabel(e.target.value)}
        />

        <select
            value={selectedGroupId}
            onChange={(e) => setSelectedGroupId(e.target.value)}
        >
            <option value="">Create new group</option>
            {groups.map((g) => (
                <option key={g._id} value={g._id}>
                    Add to: {g.name}
                </option>
            ))}
        </select>

        <button
            onClick={handleUpload}
            disabled={!selectedFile || uploading}
        >
            {uploading ? "Uploading..." : "Upload CSV"}
        </button>

    </div>


    {selectedFile && (
        <p>
            Selected: <strong>{selectedFile.name}</strong>
        </p>
    )}

    {uploadMessage && (
        <p>{uploadMessage}</p>
    )}

</div>

                {!groupsLoading && groups.length > 0 && (
                    <>
                        <h2>Dataset Groups</h2>
                        <div className="dataset-grid">
                            {groups.map((group) => (
                                <div className="dataset-card" key={group._id}>
                                    <button
                                        onClick={() => navigate(`/groups/${group._id}/trends`)}
                                    >
                                        View Trends
                                    </button>

                                    <button
                                        onClick={(e) => handleDeleteGroup(group._id, e)}
                                        style={{ background: "#ef4444", marginLeft: "8px" }}
                                    >
                                        Delete Group
                                    </button>

                                    <h3>📈 {group.name}</h3>
                                    <p className="dataset-meta">
                                        Recurring dataset series
                                    </p>
                                </div>
                            ))}
                        </div>
                    </>
                )}

                <h2>My Datasets</h2>

                {loading && <p>Loading datasets...</p>}

                {error && <p>{error}</p>}

                {!loading && datasets.length === 0 && (
                    <div className="dataset-card">
                        <h3>No datasets yet</h3>
                        <p>
                            Upload a CSV file to start analyzing your data.
                        </p>
                    </div>
                )}

                <div className="dataset-grid">

                    {datasets.map((dataset) => (

                        <div
                            className="dataset-card"
                            key={dataset._id}
                            
                        >
                            <button
    onClick={() => navigate(`/datasets/${dataset._id}`)}
>
    View Data
</button>

                            <button
                                onClick={(e) => handleDelete(dataset._id, e)}
                                style={{ background: "#ef4444", marginLeft: "8px" }}
                            >
                                Delete
                            </button>

                            <h3>📊 {dataset.name}</h3>

                            <p className="dataset-meta">
                                {dataset.originalFileName}
                                {dataset.periodLabel && ` • ${dataset.periodLabel}`}
                            </p>

                            <p>
                                <strong>{dataset.rowCount}</strong> rows
                                {" • "}
                                <strong>
                                    {dataset.columns.length}
                                </strong> columns
                            </p>

                            <div className="column-list">

                                {dataset.columns.map((column) => (

                                    <span
                                        className="column-tag"
                                        key={column._id}
                                    >
                                        {column.name}
                                    </span>

                                ))}

                            </div>

                        </div>

                    ))}

                </div>

            </main>

        </div>
    );
}

export default Dashboard;