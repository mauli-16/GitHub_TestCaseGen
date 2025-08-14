import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Dashboard from './Dashboard.jsx';
import RepoFiles from './RepoFiles.jsx';

createRoot(document.getElementById('root')).render(
    <Router>
        <Routes>
             <Route path="/" element={<App/>}></Route>
            <Route path="/dashboard" element={<Dashboard/>}></Route>
             <Route path="/files/:owner/:repo" element={<RepoFiles />} />
        </Routes>
    </Router>
   
  
)
