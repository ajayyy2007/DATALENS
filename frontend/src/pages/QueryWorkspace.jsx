import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { getDatasets, runQuery } from "../services/authService";
import { downloadCsv } from "../utils/csvExport";

function QueryWorkspace() {
    const location = useLocation();

    const [datasets, setDatasets] = useState([]);
    const [selectedDataset, setSelectedDataset] = useState("");
    const [question, setQuestion] = useState("");

    const [answer, setAnswer] = useState("");
    const [outcomes, setOutcomes] = useState([]);
    const [source, setSource] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    useEffect(() => {
        const loadDatasets = async () => {
            try {
                const data = await getDatasets();
                setDatasets(data.datasets || []);

                if (location.state?.datasetId) {
                    setSelectedDataset(location.state.datasetId);
                }
                if (location.state?.question) {
                    setQuestion(location.state.question);
                }
            } catch (error) {
                console.error("Failed to load datasets:", error);
                setError("Failed to load datasets");
            }
        };

        loadDatasets();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleExport = (results, index) => {
        downloadCsv(`query-results-${index}-${Date.now()}`, results);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!selectedDataset) {
            setError("Please select a dataset");
            return;
        }

        if (!question.trim()) {
            setError("Please enter a question");
            return;
        }

        try {
            setLoading(true);
            setError("");
            setAnswer("");
            setOutcomes([]);
            setSource(null);

            const data = await runQuery(selectedDataset, question);

            setAnswer(data.answer || "");
            setOutcomes(data.outcomes || []);
            setSource(data.source || null);

        } catch (error) {
            console.error("Query error:", error);
            setError(error.response?.data?.message || "Query failed");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="query-page">

            <div className="query-header">
                <h1>Query Workspace</h1>
                <p>
                    Ask anything about your data — even multiple things at once,
                    like "average sales and show me the full table with product names".
                </p>
            </div>

            <div className="query-card">

                <div className="form-group">
                    <label>Select Dataset</label>
                    <select
                        value={selectedDataset}
                        onChange={(e) => {
                            setSelectedDataset(e.target.value);
                            setAnswer("");
                            setOutcomes([]);
                            setSource(null);
                            setError("");
                        }}
                    >
                        <option value="">Select a dataset</option>
                        {datasets.map((dataset) => (
                            <option key={dataset._id} value={dataset._id}>
                                {dataset.name}
                            </option>
                        ))}
                    </select>
                </div>

                <div className="form-group">
                    <label>Ask a question</label>
                    <textarea
                        value={question}
                        onChange={(e) => {
                            setQuestion(e.target.value);
                            setError("");
                        }}
                        placeholder="Example: average sales and show me the table with product names"
                        rows="5"
                    />
                </div>

                <button className="query-btn" onClick={handleSubmit} disabled={loading}>
                    {loading ? "Thinking..." : "Run Query"}
                </button>

                {error && <p className="error-message">{error}</p>}

                {answer && (
                    <div className="issue-card issue-card-selected" style={{ marginTop: "2rem" }}>
                        <div className="issue-card-body">
                            <strong>Answer:</strong> {answer}
                        </div>
                    </div>
                )}

                {outcomes.length > 0 && (
                    <div className="query-results">
                        <h2 style={{ marginTop: "1.5rem" }}>Details</h2>

                        {source && (
                            <p className="muted-text">
                                Powered by {source === "ai" ? "AI" : "rule engine"}
                            </p>
                        )}

                        {outcomes.map((outcome, i) => (
                            <div key={i} style={{ marginTop: "1.5rem" }}>
                                {outcome.error ? (
                                    <p className="error-text">
                                        Part {i + 1}: {outcome.error}
                                    </p>
                                ) : (
                                    <>
                                        <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
                                            <p className="muted-text" style={{ margin: 0 }}>
                                                {outcome.plan.operation}
                                                {outcome.plan.column && ` on "${outcome.plan.column}"`}
                                                {outcome.plan.groupBy && ` grouped by "${outcome.plan.groupBy}"`}
                                                {outcome.plan.limit && ` (limit ${outcome.plan.limit})`}
                                                {outcome.source && ` — ${outcome.source === "ai" ? "AI" : "rule engine"}`}
                                            </p>
                                            <button
                                                className="btn-secondary"
                                                onClick={() => handleExport(outcome.results, i)}
                                            >
                                                ⬇ Export CSV
                                            </button>
                                        </div>

                                        {outcome.results.length > 0 && (
                                            <div className="table-container" style={{ marginTop: "0.5rem" }}>
                                                <table>
                                                    <thead>
                                                        <tr>
                                                            {Object.keys(outcome.results[0]).map((key) => (
                                                                <th key={key}>{key}</th>
                                                            ))}
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {outcome.results.map((row, rowIndex) => (
                                                            <tr key={rowIndex}>
                                                                {Object.keys(outcome.results[0]).map((key) => (
                                                                    <td key={key}>{row[key]}</td>
                                                                ))}
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>
                        ))}
                    </div>
                )}

            </div>

        </div>
    );
}

export default QueryWorkspace;