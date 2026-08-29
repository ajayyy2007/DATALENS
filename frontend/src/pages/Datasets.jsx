import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getDatasets, deleteDataset } from "../services/authService";

function Datasets() {
    const navigate = useNavigate();
    const [datasets, setDatasets] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    const loadDatasets = async () => {
        try {
            const data = await getDatasets();
            setDatasets(data.datasets);
        } catch (err) {
            setError("Failed to load datasets");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadDatasets();
    }, []);

    const handleDelete = async (id, e) => {
        e.stopPropagation();
        if (!window.confirm("Delete this dataset? This cannot be undone.")) return;
        try {
            await deleteDataset(id);
            loadDatasets();
        } catch (err) {
            alert(err.response?.data?.message || "Failed to delete dataset");
        }
    };

    return (
        <div className="dashboard">
            <aside className="sidebar">
                <div className="sidebar-logo">DataLens</div>
                <div className="sidebar-item" onClick={() => navigate("/dashboard")}>Dashboard</div>
                <div className="sidebar-item active">Datasets</div>
                <div className="sidebar-item" onClick={() => navigate("/query")}>Query Workspace</div>
                <div className="sidebar-item" onClick={() => navigate("/query-history")}>Query History</div>
            </aside>

            <main className="main-content">
                <div className="dashboard-header">
                    <h1>All Datasets</h1>
                </div>

                {loading && <p>Loading datasets...</p>}
                {error && <p className="error-text">{error}</p>}

                {!loading && datasets.length === 0 && (
                    <div className="dataset-card">
                        <h3>No datasets yet</h3>
                        <p>Upload a CSV file from the Dashboard to get started.</p>
                    </div>
                )}

                <div className="dataset-grid">
                    {datasets.map((dataset) => (
                        <div className="dataset-card" key={dataset._id}>
                            <button onClick={() => navigate(`/datasets/${dataset._id}`)}>
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
                                {dataset.versionLabel === "cleaned" && " • cleaned version"}
                            </p>
                            <p>
                                <strong>{dataset.rowCount}</strong> rows
                                {" • "}
                                <strong>{dataset.columns.length}</strong> columns
                            </p>
                            <div className="column-list">
                                {dataset.columns.map((column) => (
                                    <span className="column-tag" key={column._id}>
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

export default Datasets;