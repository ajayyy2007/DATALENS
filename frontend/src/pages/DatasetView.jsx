import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getDatasetById } from "../services/authService";
import { downloadCsv } from "../utils/csvExport";

function DatasetView() {
    const { id } = useParams();
    const navigate = useNavigate();

    const [dataset, setDataset] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        const loadDataset = async () => {
            try {
                const data = await getDatasetById(id);
                setDataset(data.dataset);
            } catch (error) {
                setError(
                    error.response?.data?.message ||
                    "Failed to load dataset"
                );
            } finally {
                setLoading(false);
            }
        };


        loadDataset();
    }, [id]);
const handleExport = () => {
    if (!dataset) return;
    downloadCsv(dataset.name, dataset.rows);
};
    if (loading) {
        return <p>Loading dataset...</p>;
    }

    if (error) {
        return <p>{error}</p>;
    }

    return (
        <div className="dataset-view">

            <button onClick={() => navigate("/dashboard")}>
                ← Back to Dashboard
            </button>

            <div className="dataset-view-header">
                <h1>{dataset.name}</h1>

                <button
                    className="btn-primary"
                    onClick={() => navigate(`/datasets/${id}/profile`)}
                >
                    View Data Health
                </button>
                <button onClick={handleExport}>⬇ Export CSV</button>
                <button
    onClick={() => navigate(`/datasets/${id}/edit`)}
>
    ✏️ Edit with AI
</button>
            </div>

            <p>
                {dataset.rowCount} rows •{" "}
                {dataset.columns.length} columns
            </p>

            <div className="table-container">

                <table>

                    <thead>
                        <tr>
                            {dataset.columns.map((column) => (
                                <th key={column._id}>
                                    {column.name}
                                </th>
                            ))}
                        </tr>
                    </thead>

                    <tbody>

                        {dataset.rows.map((row, index) => (
                            <tr key={index}>

                                {dataset.columns.map((column) => (
                                    <td key={column._id}>
                                        {row[column.name]}
                                    </td>
                                ))}

                            </tr>
                        ))}

                    </tbody>

                </table>

            </div>

        </div>
    );
}

export default DatasetView;