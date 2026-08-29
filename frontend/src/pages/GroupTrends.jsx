import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import axios from "axios";
import {
    LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from "recharts";

const API_URL = "http://localhost:5000/api";

function GroupTrends() {
    const { groupId } = useParams();
    const navigate = useNavigate();

    const [trends, setTrends] = useState(null);
    const [groupName, setGroupName] = useState("");
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        const fetchTrends = async () => {
            setLoading(true);
            setError("");
            try {
                const token = localStorage.getItem("token");
                const response = await axios.get(
                    `${API_URL}/groups/${groupId}/trends`,
                    { headers: { Authorization: `Bearer ${token}` } }
                );
                setTrends(response.data.trends);
                setGroupName(response.data.group.name);
            } catch (err) {
                setError(err.response?.data?.message || "Failed to load trends.");
            } finally {
                setLoading(false);
            }
        };
        fetchTrends();
    }, [groupId]);

    if (loading) return <div className="page-container">Calculating trends...</div>;
    if (error) return <div className="page-container"><p className="error-text">{error}</p></div>;
    if (!trends) return null;

    const { periods, revenueColumn, costColumn } = trends;

    if (periods.length === 0) {
        return (
            <div className="page-container">
                <h2>{groupName} — Trends</h2>
                <p className="muted-text">No datasets in this group yet.</p>
            </div>
        );
    }

    return (
        <div className="page-container">
            <div className="profile-header">
                <h2>{groupName} — Trends</h2>
                <button className="btn-secondary" onClick={() => navigate("/dashboard")}>
                    Back to Dashboard
                </button>
            </div>

            {!revenueColumn && !costColumn && (
                <p className="muted-text">
                    No revenue or cost column detected automatically. Showing row counts only.
                </p>
            )}

            {(revenueColumn || costColumn) && (
                <div className="chart-card" style={{ marginBottom: "1.5rem" }}>
                    <h4>Revenue{costColumn ? " vs Profit" : ""} Over Time</h4>
                    <ResponsiveContainer width="100%" height={320}>
                        <LineChart data={periods}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="periodLabel" />
                            <YAxis />
                            <Tooltip />
                            <Legend />
                            {revenueColumn && (
                                <Line type="monotone" dataKey="revenue" name="Revenue" stroke="#4f46e5" strokeWidth={2} />
                            )}
                            {costColumn && (
                                <Line type="monotone" dataKey="cost" name="Cost" stroke="#f97316" strokeWidth={2} />
                            )}
                            {revenueColumn && costColumn && (
                                <Line type="monotone" dataKey="profit" name="Profit" stroke="#16a34a" strokeWidth={2} />
                            )}
                        </LineChart>
                    </ResponsiveContainer>
                </div>
            )}

            <h3>Period Breakdown</h3>
            <table>
                <thead>
                    <tr>
                        <th>Period</th>
                        <th>Rows</th>
                        {revenueColumn && <th>Revenue</th>}
                        {costColumn && <th>Cost</th>}
                        {revenueColumn && costColumn && <th>Profit</th>}
                        {revenueColumn && <th>Revenue Change</th>}
                    </tr>
                </thead>
                <tbody>
                    {periods.map((p) => (
                        <tr key={p.datasetId}>
                            <td>{p.periodLabel}</td>
                            <td>{p.rowCount}</td>
                            {revenueColumn && <td>{p.revenue ?? "—"}</td>}
                            {costColumn && <td>{p.cost ?? "—"}</td>}
                            {revenueColumn && costColumn && (
                                <td className={p.profit >= 0 ? "quality-ok" : "issue-suggestion"}>
                                    {p.profit ?? "—"}
                                </td>
                            )}
                            {revenueColumn && (
                                <td className={p.revenueChange >= 0 ? "quality-ok" : "issue-suggestion"}>
                                    {p.revenueChange === null ? "—" : `${p.revenueChange > 0 ? "+" : ""}${p.revenueChange}%`}
                                </td>
                            )}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

export default GroupTrends;