import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
    getDatasetById,
    previewDatasetEdit,
    applyDatasetEdit,
    undoDatasetEdit
} from "../services/authService";

function TableEditor() {
    const { id } = useParams();
    const navigate = useNavigate();

    const [dataset, setDataset] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    const [instruction, setInstruction] = useState("");
    const [thinking, setThinking] = useState(false);
    const [previewData, setPreviewData] = useState(null);
    const [previewError, setPreviewError] = useState("");
    const [applying, setApplying] = useState(false);
    const [undoing, setUndoing] = useState(false);
    const [statusMessage, setStatusMessage] = useState("");

    const loadDataset = async () => {
        try {
            const data = await getDatasetById(id);
            setDataset(data.dataset);
        } catch (err) {
            setError(err.response?.data?.message || "Failed to load dataset");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadDataset();
    }, [id]);

    const handlePreview = async () => {
        if (!instruction.trim()) {
            setPreviewError("Please enter an instruction.");
            return;
        }

        setThinking(true);
        setPreviewError("");
        setPreviewData(null);
        setStatusMessage("");

        try {
            const result = await previewDatasetEdit(id, instruction);
            setPreviewData(result);
        } catch (err) {
            setPreviewError(err.response?.data?.message || "Failed to understand instruction.");
        } finally {
            setThinking(false);
        }
    };

    const handleApply = async () => {
        if (!previewData) return;

        setApplying(true);
        setStatusMessage("");

        try {
            const result = await applyDatasetEdit(id, previewData.plan, instruction);
            setStatusMessage(result.message);
            setInstruction("");
            setPreviewData(null);
            await loadDataset();
        } catch (err) {
            setStatusMessage(err.response?.data?.message || "Failed to apply edit.");
        } finally {
            setApplying(false);
        }
    };

    const handleUndo = async () => {
        if (!window.confirm("Undo the last edit on this dataset?")) return;

        setUndoing(true);
        setStatusMessage("");

        try {
            const result = await undoDatasetEdit(id);
            setStatusMessage(result.message);
            await loadDataset();
        } catch (err) {
            setStatusMessage(err.response?.data?.message || "Failed to undo.");
        } finally {
            setUndoing(false);
        }
    };

    if (loading) return <div className="page-container">Loading dataset...</div>;
    if (error) return <div className="page-container"><p className="error-text">{error}</p></div>;
    if (!dataset) return null;

    return (
        <div className="page-container">
            <div className="profile-header">
                <h2>Edit: {dataset.name}</h2>
                <button className="btn-secondary" onClick={() => navigate(`/datasets/${id}`)}>
                    Back to Raw Data
                </button>
            </div>

            <div className="issue-card" style={{ marginBottom: "1.5rem" }}>
                <div className="issue-card-body">
                    <p className="muted-text" style={{ marginBottom: "0.75rem" }}>
                        Describe the change you want in plain English. Examples:
                        "change Price to 55000 where Product is Laptop", "delete rows where Category is Furniture",
                        "add a row with Product Tablet, Category Electronics, Price 25000, Sales 40".
                    </p>

                    <textarea
                        value={instruction}
                        onChange={(e) => setInstruction(e.target.value)}
                        placeholder="e.g. change Price to 500 where Product is Chair"
                        rows="3"
                        style={{ width: "100%" }}
                    />

                    <div style={{ marginTop: "0.75rem", display: "flex", gap: "0.5rem" }}>
                        <button className="btn-primary" onClick={handlePreview} disabled={thinking}>
                            {thinking ? "Thinking..." : "Preview Edit"}
                        </button>
                        <button className="btn-secondary" onClick={handleUndo} disabled={undoing}>
                            {undoing ? "Undoing..." : "Undo Last Edit"}
                        </button>
                    </div>

                    {previewError && <p className="error-text" style={{ marginTop: "0.5rem" }}>{previewError}</p>}
                    {statusMessage && <p className="quality-ok" style={{ marginTop: "0.5rem" }}>{statusMessage}</p>}
                </div>
            </div>

            {previewData && (
                <div className="issue-card issue-card-selected" style={{ marginBottom: "1.5rem" }}>
                    <div className="issue-card-body">
                        <p>
                            <strong>Understood as:</strong> {previewData.plan.operation}
                            {previewData.plan.targetColumn && ` — set "${previewData.plan.targetColumn}" to "${previewData.plan.newValue}"`}
                            {previewData.plan.whereColumn && ` where "${previewData.plan.whereColumn}" is "${previewData.plan.whereValue}"`}
                        </p>
                        <p className="muted-text">
                            {previewData.affectedRowCount} row(s) affected.
                        </p>

                        {previewData.preview && previewData.preview.length > 0 && (
                            <div className="table-container" style={{ marginTop: "0.75rem" }}>
                                <table>
                                    <thead>
                                        <tr>
                                            {Object.keys(previewData.preview[0]).map((key) => (
                                                <th key={key}>{key}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {previewData.preview.map((row, i) => (
                                            <tr key={i}>
                                                {Object.keys(previewData.preview[0]).map((key) => (
                                                    <td key={key}>{row[key]}</td>
                                                ))}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}

                        <button
                            className="btn-primary"
                            style={{ marginTop: "0.75rem" }}
                            onClick={handleApply}
                            disabled={applying}
                        >
                            {applying ? "Applying..." : "Confirm & Apply"}
                        </button>
                    </div>
                </div>
            )}

            <h3>Current Data</h3>
            <div className="table-container">
                <table>
                    <thead>
                        <tr>
                            {dataset.columns.map((column) => (
                                <th key={column._id}>{column.name}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {dataset.rows.map((row, index) => (
                            <tr key={index}>
                                {dataset.columns.map((column) => (
                                    <td key={column._id}>{row[column.name]}</td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

export default TableEditor;