import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getQueryHistory } from "../services/authService";

function QueryHistoryPage() {
    const navigate = useNavigate();
    const [history, setHistory] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        const loadHistory = async () => {
            try {
                const data = await getQueryHistory();
                setHistory(data.history);
            } catch (err) {
                setError("Failed to load query history");
            } finally {
                setLoading(false);
            }
        };
        loadHistory();
    }, []);

    return (
        <div className="dashboard">
            <aside className="sidebar">
                <div className="sidebar-logo">DataLens</div>
                <div className="sidebar-item" onClick={() => navigate("/dashboard")}>Dashboard</div>
                <div className="sidebar-item" onClick={() => navigate("/datasets")}>Datasets</div>
                <div className="sidebar-item" onClick={() => navigate("/query")}>Query Workspace</div>
                <div className="sidebar-item active">Query History</div>
            </aside>

            <main className="main-content">
                <div className="dashboard-header">
                    <h1>Query History</h1>
                </div>

                {loading && <p>Loading history...</p>}
                {error && <p className="error-text">{error}</p>}

                {!loading && history.length === 0 && (
                    <div className="dataset-card">
                        <h3>No queries yet</h3>
                        <p>Run a query from the Query Workspace to see it here.</p>
                    </div>
                )}

                {history.length > 0 && (
                    <table>
                        <thead>
                            <tr>
                                <th>Question</th>
                                <th>Dataset</th>
                                <th>Status</th>
                                <th>Results</th>
                                <th>When</th>
                            </tr>
                        </thead>
                        <tbody>
                            {history.map((h) => (
                                <tr key={h._id}>
                                    <td>{h.question}</td>
                                    <td>{h.datasetName}</td>
                                    <td className={h.status === "success" ? "quality-ok" : "issue-suggestion"}>
                                        {h.status}
                                        {h.status === "error" && h.errorMessage && ` — ${h.errorMessage}`}
                                    </td>
                                    <td>{h.resultRowCount}</td>
                                    <td>{new Date(h.createdAt).toLocaleString()}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </main>
        </div>
    );
}

export default QueryHistoryPage;