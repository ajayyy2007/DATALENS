import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import axios from "axios";

const API_URL = "http://localhost:5000/api";

function DatasetProfile() {
    const { id } = useParams();
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    const [anomalyData, setAnomalyData] = useState(null);
    const [anomalyLoading, setAnomalyLoading] = useState(true);
    const [anomalyError, setAnomalyError] = useState("");

    useEffect(() => {
        const fetchProfile = async () => {
            setLoading(true);
            setError("");
            try {
                const token = localStorage.getItem("token");
                const response = await axios.get(
                    `${API_URL}/datasets/${id}/profile`,
                    { headers: { Authorization: `Bearer ${token}` } }
                );
                setData(response.data);
            } catch (err) {
                setError(
                    err.response?.data?.message ||
                        "Failed to load dataset profile."
                );
            } finally {
                setLoading(false);
            }
        };

        fetchProfile();
    }, [id]);

    useEffect(() => {
        const fetchAnomalies = async () => {
            setAnomalyLoading(true);
            setAnomalyError("");
            try {
                const token = localStorage.getItem("token");
                const response = await axios.get(
                    `${API_URL}/datasets/${id}/anomalies`,
                    { headers: { Authorization: `Bearer ${token}` } }
                );
                setAnomalyData(response.data);
            } catch (err) {
                setAnomalyError(
                    err.response?.data?.message || "Failed to load anomalies."
                );
            } finally {
                setAnomalyLoading(false);
            }
        };

        fetchAnomalies();
    }, [id]);

    if (loading) {
        return <div className="page-container">Loading data health...</div>;
    }

    if (error) {
        return (
            <div className="page-container">
                <p className="error-text">{error}</p>
                <Link to="/dashboard">Back to Dashboard</Link>
            </div>
        );
    }

    if (!data) return null;

    const { profile, name } = data;
    const { summary, columns } = profile;

    return (
        <div className="page-container profile-page">
          <div className="profile-header">
    <h2>{name}</h2>
  <div className="profile-header-actions">
    <Link to={`/datasets/${id}`} className="btn-secondary">
        View Raw Data
    </Link>
    <Link to={`/datasets/${id}/investigate`} className="btn-primary">
    🔍 Investigate
</Link>
    <Link to={`/datasets/${id}/clean`} className="btn-primary">
        Clean This Dataset
    </Link>
    <Link to={`/datasets/${id}/charts`} className="btn-primary">
        View Charts
    </Link>
    <Link to={`/datasets/${id}/compare`} className="btn-secondary">
    Compare Versions
</Link>
</div>
</div>

            <div className="health-score-card">
                <div className="health-score-value">
                    {summary.qualityScore}%
                </div>
                <div className="health-score-label">Data Health Score</div>
            </div>

            <div className="stat-grid">
                <StatCard label="Rows" value={summary.rowCount} />
                <StatCard label="Columns" value={summary.columnCount} />
                <StatCard label="Missing Values" value={summary.missingCells} />
                <StatCard label="Duplicate Rows" value={summary.duplicateRows} />
                <StatCard label="Numeric Columns" value={summary.numericColumnCount} />
                <StatCard label="Categorical Columns" value={summary.categoricalColumnCount} />
                <StatCard label="Text Columns" value={summary.textColumnCount} />
                <StatCard label="Date Columns" value={summary.dateColumnCount} />
            </div>

            <h3>Column Profile</h3>
            <div className="column-profile-list">
                {columns.map((col) => (
                    <ColumnProfileCard key={col.name} column={col} />
                ))}
            </div>

            <h3>Data Quality</h3>
            <ul className="quality-checklist">
                <QualityItem
                    ok={summary.missingCells === 0}
                    okText="No missing values"
                    badText={`${summary.missingCells} missing value(s) detected`}
                />
                <QualityItem
                    ok={summary.duplicateRows === 0}
                    okText="No duplicate rows"
                    badText={`${summary.duplicateRows} duplicate row(s) detected`}
                />
                <QualityItem
                    ok={summary.invalidNumericCells === 0}
                    okText="No invalid numeric values"
                    badText={`${summary.invalidNumericCells} invalid numeric value(s) detected`}
                />
                <QualityItem
                    ok={summary.categoricalInconsistencyCount === 0}
                    okText="No category inconsistencies"
                    badText={`${summary.categoricalInconsistencyCount} category inconsistency group(s) detected`}
                />
            </ul>

            <h3>Anomaly Detection</h3>
            {anomalyLoading && <p>Scanning for anomalies...</p>}
            {anomalyError && <p className="error-text">{anomalyError}</p>}
            {anomalyData && (
                <AnomalySection anomalies={anomalyData.anomalies} />
            )}
        </div>
    );
}

function StatCard({ label, value }) {
    return (
        <div className="stat-card">
            <div className="stat-value">{value}</div>
            <div className="stat-label">{label}</div>
        </div>
    );
}

function ColumnProfileCard({ column }) {
    return (
        <div className="column-card">
            <div className="column-card-header">
                <span className="column-name">{column.name}</span>
                <span className={`type-badge type-${column.profileType}`}>
                    {column.profileType}
                </span>
            </div>
            <div className="column-card-body">
                <div>Unique values: {column.uniqueCount}</div>
                <div>Missing: {column.missingCount}</div>

                {column.profileType === "numeric" && column.stats && (
                    <>
                        <div>Min: {column.stats.min ?? "—"}</div>
                        <div>Max: {column.stats.max ?? "—"}</div>
                        <div>Average: {column.stats.average ?? "—"}</div>
                        <div>Median: {column.stats.median ?? "—"}</div>
                        {column.stats.invalidCount > 0 && (
                            <div className="warning-text">
                                {column.stats.invalidCount} invalid numeric value(s)
                            </div>
                        )}
                    </>
                )}

                {column.profileType === "categorical" &&
                    column.stats?.inconsistentGroups?.length > 0 && (
                        <div className="warning-text">
                            Potential inconsistency:{" "}
                            {column.stats.inconsistentGroups
                                .map((g) => g.variants.join(" / "))
                                .join(", ")}
                        </div>
                    )}
            </div>
        </div>
    );
}

function QualityItem({ ok, okText, badText }) {
    return (
        <li className={ok ? "quality-ok" : "quality-warn"}>
            {ok ? "✓ " : "⚠ "}
            {ok ? okText : badText}
        </li>
    );
}

function AnomalySection({ anomalies }) {
    if (anomalies.totalAnomalyCount === 0) {
        return <p className="quality-ok">✓ No anomalies detected</p>;
    }

    return (
        <div className="anomaly-list">
            {anomalies.columns
                .filter((col) => col.anomalies.length > 0)
                .map((col) => (
                    <AnomalyColumnCard key={col.column} col={col} />
                ))}
        </div>
    );
}

function AnomalyColumnCard({ col }) {
    return (
        <div className="anomaly-card">
            <div className="anomaly-card-header">
                <span className="column-name">{col.column}</span>
                <span className="anomaly-count-badge">
                    {col.anomalies.length} anomal
                    {col.anomalies.length === 1 ? "y" : "ies"}
                </span>
            </div>
            <div className="anomaly-card-body">
                <div>
                    Expected range: {col.expectedRange.min} –{" "}
                    {col.expectedRange.max}
                </div>
                <ul className="anomaly-value-list">
                    {col.anomalies.slice(0, 10).map((a, i) => (
                        <li key={i}>
                            Row {a.rowIndex + 1}: value {a.value} (
                            {a.deviation}, {a.direction} range)
                        </li>
                    ))}
                </ul>
                {col.anomalies.length > 10 && (
                    <div className="muted-text">
                        + {col.anomalies.length - 10} more
                    </div>
                )}
            </div>
        </div>
    );
}

export default DatasetProfile;