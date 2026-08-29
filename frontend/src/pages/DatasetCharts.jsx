import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import axios from "axios";
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
    ResponsiveContainer, PieChart, Pie, Cell, ScatterChart, Scatter
} from "recharts";

const API_URL = "http://localhost:5000/api";
const COLORS = ["#2563eb", "#f97316", "#16a34a", "#dc2626", "#9333ea", "#0891b2", "#ca8a04", "#db2777"];

function DatasetCharts() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [charts, setCharts] = useState([]);
    const [name, setName] = useState("");
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        const fetchCharts = async () => {
            setLoading(true);
            setError("");
            try {
                const token = localStorage.getItem("token");
                const response = await axios.get(
                    `${API_URL}/datasets/${id}/charts`,
                    { headers: { Authorization: `Bearer ${token}` } }
                );
                setCharts(response.data.charts);
                setName(response.data.name);
            } catch (err) {
                setError(err.response?.data?.message || "Failed to load charts.");
            } finally {
                setLoading(false);
            }
        };
        fetchCharts();
    }, [id]);

    if (loading) return <div className="page-container">Building visualizations...</div>;
    if (error) return <div className="page-container"><p className="error-text">{error}</p></div>;

    return (
        <div className="page-container">
            <div className="profile-header">
                <h2>Charts: {name}</h2>
                <button className="btn-secondary" onClick={() => navigate(`/datasets/${id}/profile`)}>
                    Back to Data Health
                </button>
            </div>

            {charts.length === 0 && <p className="muted-text">No suitable charts found for this dataset.</p>}

            <div className="chart-grid">
                {charts.map((chart, i) => (
                    <div className="chart-card" key={i}>
                        <h4>{chart.title}</h4>
                        <ResponsiveContainer width="100%" height={280}>
                            {renderChart(chart)}
                        </ResponsiveContainer>
                    </div>
                ))}
            </div>
        </div>
    );
}

function renderChart(chart) {
    if (chart.type === "bar" || chart.type === "histogram") {
        return (
            <BarChart data={chart.data}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey={chart.xKey} />
                <YAxis />
                <Tooltip />
                <Bar dataKey={chart.yKey} fill="#2563eb" />
            </BarChart>
        );
    }

    if (chart.type === "pie") {
        return (
            <PieChart>
                <Pie
                    data={chart.data}
                    dataKey={chart.valueKey}
                    nameKey={chart.nameKey}
                    cx="50%"
                    cy="50%"
                    outerRadius={90}
                    label
                >
                    {chart.data.map((_, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                </Pie>
                <Tooltip />
                <Legend />
            </PieChart>
        );
    }

    if (chart.type === "scatter") {
        return (
            <ScatterChart>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey={chart.xKey} name={chart.xKey} />
                <YAxis dataKey={chart.yKey} name={chart.yKey} />
                <Tooltip cursor={{ strokeDasharray: "3 3" }} />
                <Scatter data={chart.data} fill="#f97316" />
            </ScatterChart>
        );
    }

    return null;
}

export default DatasetCharts;