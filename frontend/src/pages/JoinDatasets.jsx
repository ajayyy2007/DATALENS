import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
    getDatasets,
    suggestJoinKey,
    joinDatasets
} from "../services/authService";

function JoinDatasets() {
    const navigate = useNavigate();

    const [datasets, setDatasets] = useState([]);
    const [datasetAId, setDatasetAId] = useState("");
    const [datasetBId, setDatasetBId] = useState("");

    const [suggestion, setSuggestion] = useState(null);
    const [suggesting, setSuggesting] = useState(false);
    const [suggestError, setSuggestError] = useState("");

    const [columnA, setColumnA] = useState("");
    const [columnB, setColumnB] = useState("");

    const [joining, setJoining] = useState(false);
    const [joinError, setJoinError] = useState("");

    useEffect(() => {
        const loadDatasets = async () => {
            try {
                const data = await getDatasets();
                setDatasets(data.datasets || []);
            } catch (err) {
                console.error("Failed to load datasets:", err);
            }
        };
        loadDatasets();
    }, []);

    const datasetA = datasets.find((d) => d._id === datasetAId);
    const datasetB = datasets.find((d) => d._id === datasetBId);

    const handleSuggest = async () => {
        if (!datasetAId || !datasetBId) {
            setSuggestError("Select both datasets first.");
            return;
        }
        if (datasetAId === datasetBId) {
            setSuggestError("Choose two different datasets.");
            return;
        }

        setSuggesting(true);
        setSuggestError("");
        setSuggestion(null);

        try {
            const result = await suggestJoinKey(datasetAId, datasetBId);
            setSuggestion(result.suggestion);
            setColumnA(result.suggestion.columnA);
            setColumnB(result.suggestion.columnB);
        } catch (err) {
            setSuggestError(err.response?.data?.message || "Failed to suggest a join key.");
        } finally {
            setSuggesting(false);
        }
    };

    const handleJoin = async () => {
        if (!columnA || !columnB) {
            setJoinError("Select join columns for both datasets.");
            return;
        }

        setJoining(true);
        setJoinError("");

        try {
            const result = await joinDatasets(datasetAId, datasetBId, columnA, columnB);
            navigate(`/datasets/${result.dataset.id}`);
        } catch (err) {
            setJoinError(err.response?.data?.message || "Failed to join datasets.");
        } finally {
            setJoining(false);
        }
    };

    return (
        <div className="page-container">
            <div className="profile-header">
                <h2>Join Datasets</h2>
                <button className="btn-secondary" onClick={() => navigate("/datasets")}>
                    Back to Datasets
                </button>
            </div>

            <p className="muted-text" style={{ marginBottom: "1.5rem" }}>
                Combine two datasets into one, like a database JOIN. AI suggests the best shared
                column to match rows on — you can override it before combining.
            </p>

            <div className="compare-controls" style={{ marginBottom: "1rem" }}>
                <select value={datasetAId} onChange={(e) => { setDatasetAId(e.target.value); setSuggestion(null); }}>
                    <option value="">Select first dataset</option>
                    {datasets.map((d) => (
                        <option key={d._id} value={d._id}>{d.name}</option>
                    ))}
                </select>

                <select value={datasetBId} onChange={(e) => { setDatasetBId(e.target.value); setSuggestion(null); }}>
                    <option value="">Select second dataset</option>
                    {datasets.map((d) => (
                        <option key={d._id} value={d._id}>{d.name}</option>
                    ))}
                </select>

                <button className="btn-primary" onClick={handleSuggest} disabled={suggesting}>
                    {suggesting ? "Analyzing..." : "Suggest Join Key"}
                </button>
            </div>

            {suggestError && <p className="error-text">{suggestError}</p>}

            {suggestion && (
                <div className="issue-card issue-card-selected" style={{ marginBottom: "1.5rem" }}>
                    <div className="issue-card-body">
                        <p>
                            <strong>Suggested match:</strong> "{suggestion.columnA}" in {datasetA?.name} ↔ "{suggestion.columnB}" in {datasetB?.name}
                        </p>
                        <p className="muted-text">
                            {Math.round(suggestion.overlap * 100)}% of values overlap between these columns.
                        </p>

                        <div style={{ display: "flex", gap: "1rem", marginTop: "0.75rem" }}>
                            <div>
                                <label style={{ display: "block", marginBottom: "0.25rem" }}>
                                    Column from {datasetA?.name}
                                </label>
                                <select value={columnA} onChange={(e) => setColumnA(e.target.value)}>
                                    {datasetA?.columns.map((c) => (
                                        <option key={c._id} value={c.name}>{c.name}</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label style={{ display: "block", marginBottom: "0.25rem" }}>
                                    Column from {datasetB?.name}
                                </label>
                                <select value={columnB} onChange={(e) => setColumnB(e.target.value)}>
                                    {datasetB?.columns.map((c) => (
                                        <option key={c._id} value={c.name}>{c.name}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        {joinError && <p className="error-text" style={{ marginTop: "0.5rem" }}>{joinError}</p>}

                        <button
                            className="btn-primary"
                            style={{ marginTop: "1rem" }}
                            onClick={handleJoin}
                            disabled={joining}
                        >
                            {joining ? "Joining..." : "Join Datasets"}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

export default JoinDatasets;