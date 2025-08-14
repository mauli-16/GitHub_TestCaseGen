import React, { useState, useEffect } from "react";
import axios from "axios";
import "./Dashboard.css";
import { useNavigate } from "react-router-dom";

const Dashboard = () => {
  const navigate=useNavigate()
  const [repoData, setRepoData] = useState([]);
  
  useEffect(() => {
    const fetchRepos = async () => {
      try {
        const res = await axios.get("http://localhost:3000/getRepos", {
          withCredentials: true,
        });
        setRepoData(res.data);
      } catch (error) {
        console.error("Error fetching:", error);
      }
    };

    fetchRepos();
  }, []);


   const handleRepoSelect = async (repo) => {
     navigate(`/files/${repo.owner.login}/${repo.name}`);
  };


  return (
    <div>
      <h2>Your Github Repositories:</h2>
      {repoData.length > 0 ? (
        <div className="container">
          {repoData.map((repo) => (
            <div key={repo.id} onClick={()=>handleRepoSelect(repo)} className="repoBox">
              <h3>{repo.name}</h3>
              <p>{repo.description || "No description"}</p>
              <p>Language: {repo.language || "Not specified"}</p>
              <p>Stars: {repo.stargazers_count}</p>
              <a href={repo.html_url} target="_blank" rel="noopener noreferrer">
                View on GitHub
              </a>
              
            </div>
          ))}
        </div>
      ) : (
        <p>Loading Repositories....</p>
      )}
    </div>
  );
};

export default Dashboard;
