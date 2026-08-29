import { BrowserRouter, Routes, Route, Link } from "react-router-dom";
import ProtectedRoute from "./components/ProtectedRoute";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard";
import Datasets from "./pages/Datasets";
import DatasetView from "./pages/DatasetView";
import QueryWorkspace from "./pages/QueryWorkspace";
import DatasetProfile from "./pages/DatasetProfile";
import DataCleaning from "./pages/DataCleaning";
import DatasetCharts from "./pages/DatasetCharts";
import DatasetCompare from "./pages/DatasetCompare";
import GroupTrends from "./pages/GroupTrends";
import QueryHistoryPage from "./pages/QueryHistoryPage";
import InvestigationReport from "./pages/InvestigationReport";
import TableEditor from "./pages/TableEditor";
import JoinDatasets from "./pages/JoinDatasets";


function NavBar() {
    const isLoggedIn = Boolean(localStorage.getItem("token"));

    if (isLoggedIn) {
        return null;
    }

    return (
        <nav className="app-navbar">
            <div className="app-navbar-brand">DataLens</div>
            <div className="app-navbar-links">
                <Link to="/login" className="app-navbar-link">
                    Login
                </Link>
                <Link to="/register" className="app-navbar-link app-navbar-link-primary">
                    Register
                </Link>
            </div>
        </nav>
    );
}

function App() {
    return (
        <BrowserRouter>

            <NavBar />

            <Routes>

                <Route
                    path="/"
                    element={<Login />}
                />

                <Route
                    path="/login"
                    element={<Login />}
                />

                <Route
                    path="/register"
                    element={<Register />}
                />

               <Route
    path="/dashboard"
    element={
        <ProtectedRoute>
            <Dashboard />
        </ProtectedRoute>
    }
/>
<Route
    path="/datasets"
    element={
        <ProtectedRoute>
            <Datasets />
        </ProtectedRoute>
    }
/>
<Route
    path="/datasets/:id"
    element={
        <ProtectedRoute>
            <DatasetView />
        </ProtectedRoute>
    }

/>
<Route
    path="/query"
    element={
        <ProtectedRoute>
            <QueryWorkspace />
        </ProtectedRoute>
    }
/>
<Route
  path="/datasets/:id/profile"
  element={
    <ProtectedRoute>
      <DatasetProfile />
    </ProtectedRoute>
  }
/>
<Route
  path="/datasets/:id/clean"
  element={
    <ProtectedRoute>
      <DataCleaning />
    </ProtectedRoute>
  }
/>
<Route
  path="/datasets/:id/charts"
  element={
    <ProtectedRoute>
      <DatasetCharts />
    </ProtectedRoute>
  }
/>

<Route
  path="/datasets/:id/compare"
  element={
    <ProtectedRoute>
      <DatasetCompare />
    </ProtectedRoute>
  }
/>
<Route
  path="/groups/:groupId/trends"
  element={
    <ProtectedRoute>
      <GroupTrends />
    </ProtectedRoute>
  }
/>
<Route
  path="/query-history"
  element={
    <ProtectedRoute>
      <QueryHistoryPage />
    </ProtectedRoute>
  }
/>
<Route
  path="/datasets/:id/investigate"
  element={
    <ProtectedRoute>
      <InvestigationReport />
    </ProtectedRoute>
  }
/>
<Route
  path="/datasets/:id/edit"
  element={
    <ProtectedRoute>
      <TableEditor />
    </ProtectedRoute>
  }
/>
<Route
  path="/join"
  element={
    <ProtectedRoute>
      <JoinDatasets />
    </ProtectedRoute>
  }
/>

            </Routes>

        </BrowserRouter>
    );
}

export default App;