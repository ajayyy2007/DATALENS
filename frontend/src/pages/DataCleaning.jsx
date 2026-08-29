import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import axios from "axios";

const API_URL = "http://localhost:5000/api";

const SELECTABLE_TYPES = ["duplicate_rows", "category_inconsistency"];

function issueKey(issue, index) {
    // Issues don't have stable IDs from the backend, so build one
    // from type + column + index for React keys and selection tracking.
    return `${issue.type}:${issue.column || "dataset"}:${index}`;
}

function DataCleaning() {
    const { id } = useParams();
    const navigate = useNavigate();

    const [report, setReport] = useState(null);
    const [datasetName, setDatasetName] = useState("");
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    const [selectedKeys, setSelectedKeys] = useState(new Set());
    const [applying, setApplying] = useState(false);
    const [applyError, setApplyError] = useState("");

    useEffect(() => {
        const fetchReport = async () => {
            setLoading(true);
            setError("");
            try {
                const token = localStorage.getItem("token");
                const response = await axios.get(
                    `${API_URL}/datasets/${id}/cleaning-suggestions`,
                    { headers: { Authorization: `Bearer ${token}` } }
                );
                setReport(response.data.report);
                setDatasetName(response.data.name);
            } catch (err) {
                setError(
                    err.response?.data?.message ||
                        "Failed to load cleaning suggestions."
                );
            } finally {
                setLoading(false);
            }
        };

        fetchReport();
    }, [id]);

    const toggleSelection = (key) => {
        setSelectedKeys((prev) => {
            const next = new Set(prev);
            if (next.has(key)) {
                next.delete(key);
            } else {
                next.add(key);
            }
            return next;
        });
    };

    const handleApply = async () => {
        if (!report) return;

        const selectedFixes = report.issues.filter((issue, index) =>
            selectedKeys.has(issueKey(issue, index))
        );

        if (selectedFixes.length === 0) {
            setApplyError("Select at least one fix to apply.");
            return;
        }

        setApplying(true);
        setApplyError("");

        try {
            const token = localStorage.getItem("token");
            const response = await axios.post(
                `${API_URL}/datasets/${id}/clean`,
                { selectedFixes },
                { headers: { Authorization: `Bearer ${token}` } }
            );

            const newDatasetId = response.data.dataset.id;
            navigate(`/datasets/${newDatasetId}`);
        } catch (err) {
            setApplyError(
                err.response?.data?.message ||
                    "Failed to apply cleaning fixes."
            );
        } finally {
            setApplying(false);
        }
    };

    if (loading) {
        return <div className="page-container">Analyzing dataset...</div>;
    }

    if (error) {
        return (
            <div className="page-container">
                <p className="error-text">{error}</p>
                <button onClick={() => navigate("/dashboard")}>
                    Back to Dashboard
                </button>
            </div>
        );
    }

    if (!report) return null;

    const selectableIssues = report.issues.filter((issue) =>
        SELECTABLE_TYPES.includes(issue.type)
    );
    const informationalIssues = report.issues.filter(
        (issue) => !SELECTABLE_TYPES.includes(issue.type)
    );

    return (
        <div className="page-container cleaning-page">
            <div className="profile-header">
                <h2>Clean: {datasetName}</h2>
                <button
                    className="btn-secondary"
                    onClick={() => navigate(`/datasets/${id}/profile`)}
                >
                    Back to Data Health
                </button>
            </div>

            {report.issueCount === 0 && (
                <p className="quality-ok">
                    ✓ No cleaning issues detected in this dataset.
                </p>
            )}

            {selectableIssues.length > 0 && (
                <>
                    <h3>Fixable Issues</h3>
                    <p className="muted-text">
                        Select which fixes to apply. A new cleaned dataset
                        will be created — your original data is never
                        modified.
                    </p>
                    <div className="issue-list">
                        {report.issues.map((issue, index) => {
                            if (!SELECTABLE_TYPES.includes(issue.type)) {
                                return null;
                            }
                            const key = issueKey(issue, index);
                            return (
                                <IssueCard
                                    key={key}
                                    issue={issue}
                                    selected={selectedKeys.has(key)}
                                    onToggle={() => toggleSelection(key)}
                                    selectable
                                />
                            );
                        })}
                    </div>

                    {applyError && (
                        <p className="error-text">{applyError}</p>
                    )}

                    <button
                        className="btn-primary"
                        onClick={handleApply}
                        disabled={applying || selectedKeys.size === 0}
                    >
                        {applying
                            ? "Applying..."
                            : `Apply Selected Fixes (${selectedKeys.size})`}
                    </button>
                </>
            )}

            {informationalIssues.length > 0 && (
                <>
                    <h3>Other Issues Found</h3>
                    <p className="muted-text">
                        These require manual review and are not
                        auto-applied yet.
                    </p>
                    <div className="issue-list">
                        {report.issues.map((issue, index) => {
                            if (SELECTABLE_TYPES.includes(issue.type)) {
                                return null;
                            }
                            const key = issueKey(issue, index);
                            return (
                                <IssueCard
                                    key={key}
                                    issue={issue}
                                    selectable={false}
                                />
                            );
                        })}
                    </div>
                </>
            )}
        </div>
    );
}

function IssueCard({ issue, selected, onToggle, selectable }) {
    return (
        <div
            className={`issue-card ${
                selectable && selected ? "issue-card-selected" : ""
            }`}
        >
            <div className="issue-card-header">
                {selectable && (
                    <input
                        type="checkbox"
                        checked={selected}
                        onChange={onToggle}
                    />
                )}
                <span className="issue-type-badge">
                    {issue.type.replace(/_/g, " ")}
                </span>
                {issue.column && (
                    <span className="column-name">{issue.column}</span>
                )}
            </div>

            <div className="issue-card-body">
                <div>{issue.description}</div>
                <div className="issue-suggestion">
                    Suggestion: {issue.suggestion}
                </div>

                {issue.type === "category_inconsistency" && (
                    <div className="issue-variants">
                        Variants:{" "}
                        {issue.variants
                            .map((v) => `"${v.value}" (${v.count})`)
                            .join(", ")}
                    </div>
                )}

                {issue.type === "duplicate_rows" && (
                    <div className="issue-variants">
                        {issue.affectedRowGroups.length} group(s) of
                        duplicate rows
                    </div>
                )}

                {issue.type === "invalid_numeric" && issue.invalidValues && (
                    <div className="issue-variants">
                        Examples:{" "}
                        {issue.invalidValues
                            .slice(0, 5)
                            .map((v) => `row ${v.rowIndex + 1}: "${v.value}"`)
                            .join(", ")}
                    </div>
                )}
            </div>
        </div>
    );
}

export default DataCleaning;