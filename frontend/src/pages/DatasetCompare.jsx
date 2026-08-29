import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import axios from "axios";

const API_URL = "http://localhost:5000/api";

function DatasetCompare() {
    const { id } = useParams();
    const navigate = useNavigate();

    const [versions, setVersions] = useState([]);
    const [datasetBId, setDatasetBId] = useState("");
    const [comparison, setComparison] = useState(null);
    const [loading, setLoading] = useState(true);
    const [comparing, setComparing] = useState(false);
    const [error, setError] = useState("");

    useEffect(() => {
        const fetchVersions = async () => {
            try {
                const token = localStorage.getItem("token");
                const response = await axios.get(
                    `${API_URL}/datasets/${id}/versions`,
                    { headers: { Authorization: `Bearer ${token}` } }
                );
                setVersions(response.data.versions);
            } catch (err) {
                setError(err.response?.data?.message || "Failed to load versions.");
            } finally {
                setLoading(false);
            }
        };
        fetchVersions();
    }, [id]);

    const handleCompare = async () => {
        if (!datasetBId) return;
        setComparing(true);
        setError("");
        try {
            const token = localStorage.getItem("token");
            const response = await axios.post(
                `${API_URL}/datasets/compare`,
                { datasetAId: id, datasetBId },
                { headers: { Authorization: `Bearer ${token}` } }
            );
            setComparison(response.data);
        } catch (err) {
            setError(err.response?.data?.message || "Failed to compare datasets.");
        } finally {
            setComparing(false);
        }
    };

    if (loading) return <div className="page-container">Loading versions...</div>;

    return (
        <div className="page-container">
            <div className="profile-header">
                <h2>Compare Dataset</h2>
                <button className="btn-secondary" onClick={() => navigate(`/datasets/${id}/profile`)}>
                    Back to Data Health
                </button>
            </div>

            <div className="compare-controls">
                <select value={datasetBId} onChange={(e) => setDatasetBId(e.target.value)}>
                    <option value="">Select a version to compare against...</option>
                    {versions
                        .filter((v) => v._id !== id)
                        .map((v) => (
                            <option key={v._id} value={v._id}>
                                {v.name} ({v.versionLabel})
                            </option>
                        ))}
                </select>
                <button className="btn-primary" onClick={handleCompare} disabled={!datasetBId || comparing}>
                    {comparing ? "Comparing..." : "Compare"}
                </button>
            </div>

            {error && <p className="error-text">{error}</p>}

            {comparison && (
                <div className="comparison-results">
                    <h3>Metric Changes</h3>
                    <table>
                        <thead>
                            <tr><th>Metric</th><th>Before</th><th>After</th><th>Change</th></tr>
                        </thead>
                        <tbody>
                            {comparison.comparison.metrics.map((m) => (
                                <tr key={m.column}>
                                    <td>{m.column}</td>
                                    <td>{m.totalA}</td>
                                    <td>{m.totalB}</td>
                                    <td className={m.percentChange >= 0 ? "quality-ok" : "issue-suggestion"}>
                                        {m.percentChange === null ? "—" : `${m.percentChange > 0 ? "+" : ""}${m.percentChange}%`}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>

                    {comparison.comparison.categoryBreakdown && (
                        <>
                            <h3>Category Breakdown ({comparison.comparison.categoryBreakdown.metric})</h3>
                            <table>
                                <thead>
                                    <tr><th>Category</th><th>Before</th><th>After</th><th>Change</th></tr>
                                </thead>
                                <tbody>
                                    {comparison.comparison.categoryBreakdown.all.map((c) => (
                                        <tr key={c.category}>
                                            <td>{c.category}</td>
                                            <td>{c.before}</td>
                                            <td>{c.after}</td>
                                            <td className={c.percentChange >= 0 ? "quality-ok" : "issue-suggestion"}>
                                                {c.percentChange === null ? "—" : `${c.percentChange > 0 ? "+" : ""}${c.percentChange}%`}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </>
                    )}

                    <h3>Row Changes</h3>
                    <p>
                        {comparison.comparison.rowChanges.newRowCount} new rows,{" "}
                        {comparison.comparison.rowChanges.removedRowCount} removed rows,{" "}
                        {comparison.comparison.rowChanges.changedRowCount} changed rows
                    </p>
                </div>
            )}
        </div>
    );
}

export default DatasetCompare;