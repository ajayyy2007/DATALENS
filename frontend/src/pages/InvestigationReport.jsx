import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { investigateDataset } from "../services/authService";
import { downloadTextFile } from "../utils/csvExport";
const STATUS_LABELS = {
    clean: { text: "✓ Dataset is clean", className: "quality-ok" },
    minor_issues: { text: "⚠ Minor issues found", className: "quality-warn" },
    needs_attention: { text: "⚠ Needs attention", className: "error-text" },
};

function InvestigationReport() {
    const { id } = useParams();
    const navigate = useNavigate();

    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        const run = async () => {
            setLoading(true);
            setError("");
            try {
                const result = await investigateDataset(id);
                setData(result);
            } catch (err) {
                setError(err.response?.data?.message || "Failed to run investigation.");
            } finally {
                setLoading(false);
            }
        };
        run();
    }, [id]);

    if (loading) return <div className="page-container">Investigating dataset...</div>;
    if (error) return <div className="page-container"><p className="error-text">{error}</p></div>;
    if (!data) return null;

    const { report, name } = data;
    const statusInfo = STATUS_LABELS[report.status] || STATUS_LABELS.minor_issues;

    const handleExportReport = () => {
        const lines = [];
        lines.push(`INVESTIGATION REPORT: ${name}`);
        lines.push(`Generated: ${new Date().toLocaleString()}`);
        lines.push("");
        lines.push(`Status: ${statusInfo.text}`);
        lines.push(`Quality Score: ${report.profile.summary.qualityScore}%`);
        lines.push("");
        lines.push("SUMMARY");
        report.summarySentences.forEach((s) => lines.push(`- ${s}`));
        lines.push("");
        if (report.topPerformer) {
            lines.push("TOP PERFORMER");
            lines.push(`${report.topPerformer.label || "—"}: ${report.topPerformer.column} = ${report.topPerformer.value}`);
            lines.push("");
        }
        lines.push("DATA HEALTH SNAPSHOT");
        lines.push(`Rows: ${report.profile.summary.rowCount}`);
        lines.push(`Missing Values: ${report.profile.summary.missingCells}`);
        lines.push(`Duplicate Rows: ${report.profile.summary.duplicateRows}`);
        lines.push(`Anomalies: ${report.anomalies.totalAnomalyCount}`);
        lines.push(`Cleaning Issues: ${report.cleaning.issueCount}`);
        lines.push("");
        if (report.suggestedQuestions.length > 0) {
            lines.push("SUGGESTED QUESTIONS");
            report.suggestedQuestions.forEach((q) => lines.push(`- ${q}`));
        }

        downloadTextFile(`investigation-report-${name}`, lines.join("\n"));
    };

    return (
        <div className="page-container">
            <div className="profile-header">
                <h2>Investigation Report: {name}</h2>
                <div className="profile-header-actions">
                    <button className="btn-secondary" onClick={handleExportReport}>
                        ⬇ Export Report
                    </button>
                    <button className="btn-secondary" onClick={() => navigate(`/datasets/${id}/profile`)}>
                        Back to Data Health
                    </button>
                </div>
            </div>

            <div className="health-score-card">
                <div className={`health-score-value ${statusInfo.className}`} style={{ fontSize: "1.75rem" }}>
                    {statusInfo.text}
                </div>
                <div className="health-score-label">
                    Overall Quality Score: {report.profile.summary.qualityScore}%
                </div>
            </div>

            <h3>Summary</h3>
            <div className="issue-card">
                <div className="issue-card-body">
                    {report.summarySentences.map((s, i) => (
                        <p key={i} style={{ margin: "0.4rem 0" }}>{s}</p>
                    ))}
                </div>
            </div>

            {report.topPerformer && (
                <>
                    <h3>Top Performer</h3>
                    <div className="stat-grid">
                        <div className="stat-card">
                            <div className="stat-value">
                                {report.topPerformer.label || "—"}
                            </div>
                            <div className="stat-label">
                                Highest {report.topPerformer.column}: {report.topPerformer.value}
                            </div>
                        </div>
                    </div>
                </>
            )}

            <h3>Data Health Snapshot</h3>
            <div className="stat-grid">
                <div className="stat-card">
                    <div className="stat-value">{report.profile.summary.rowCount}</div>
                    <div className="stat-label">Rows</div>
                </div>
                <div className="stat-card">
                    <div className="stat-value">{report.profile.summary.missingCells}</div>
                    <div className="stat-label">Missing Values</div>
                </div>
                <div className="stat-card">
                    <div className="stat-value">{report.profile.summary.duplicateRows}</div>
                    <div className="stat-label">Duplicate Rows</div>
                </div>
                <div className="stat-card">
                    <div className="stat-value">{report.anomalies.totalAnomalyCount}</div>
                    <div className="stat-label">Anomalies</div>
                </div>
                <div className="stat-card">
                    <div className="stat-value">{report.cleaning.issueCount}</div>
                    <div className="stat-label">Cleaning Issues</div>
                </div>
            </div>

            {report.suggestedQuestions.length > 0 && (
                <>
                    <h3>Suggested Questions</h3>
                    <div className="issue-list">
                        {report.suggestedQuestions.map((q, i) => (
                            <div
                                className="issue-card"
                                key={i}
                                style={{ cursor: "pointer" }}
                                onClick={() => navigate("/query", { state: { datasetId: id, question: q } })}
                            >
                                <div className="issue-card-body">→ {q}</div>
                            </div>
                        ))}
                    </div>
                </>
            )}

          <div className="profile-header-actions" style={{ marginTop: "1.5rem" }}>
    <button className="btn-primary" onClick={() => navigate(`/datasets/${id}/profile`)}>
        View Full Data Health
    </button>
    <button className="btn-secondary" onClick={() => navigate(`/datasets/${id}/clean`)}>
        Review Cleaning Suggestions
    </button>
    <button className="btn-secondary" onClick={() => navigate(`/datasets/${id}/charts`)}>
        View Charts
    </button>
</div>
        </div>
    );
}

export default InvestigationReport;