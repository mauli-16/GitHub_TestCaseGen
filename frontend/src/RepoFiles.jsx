import React, { useEffect, useState } from "react";
import axios from "axios";
import { useParams } from "react-router-dom"; 
import "./RepoFiles.css";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
const RepoFiles = () => {
  const { owner, repo } = useParams(); 
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [generatingTests, setGeneratingTests] = useState(false);
  const [generatingFullCode, setGeneratingFullCode] = useState(false);
  const [fullTestCode, setFullTestCode] = useState("");
  const [testSummary, setTestSummary] = useState("");
  const [raisingPR, setRaisingPR] = useState(false);

  useEffect(() => {
    const fetchFiles = async () => {
      try {
        const response = await axios.get(
          `http://localhost:3000/getAllRepoFiles/${owner}/${repo}`,
          { withCredentials: true }
        );
        setFiles(response.data);
      } catch (error) {
        console.error("Error fetching repo files:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchFiles();
  }, [owner, repo]);

  const handleFileSelect = (file) => {
    setSelectedFiles((prev) => {
      if (prev.includes(file)) {
        return prev.filter((f) => f !== file);
      }
      return [...prev, file];
    });
  };

  const generateFullCode = async () => {
    if (!testSummary) {
      alert("Please generate test summary first");
      return;
    }

    setGeneratingFullCode(true);

    try {
      
      const fileContents = await Promise.all(
        selectedFiles.map(async (file) => {
          const response = await axios.get(
            `http://localhost:3000/getFileContent/${owner}/${repo}?path=${file.path}`,
            { withCredentials: true }
          );
          return {
            path: file.path,
            content: response.data.content,
          };
        })
      );

      
      const aiResponse = await axios.post(
        "http://localhost:3000/generateFullTestCode",
        {
          files: fileContents,
          testSummary: testSummary, 
        },
        { withCredentials: true }
      );

      setFullTestCode(aiResponse.data.fullCode);
    } catch (error) {
      console.error("Error generating full test code:", error);
      alert("Failed to generate full test code");
    } finally {
      setGeneratingFullCode(false);
    }
  };

  const generateTestSummary = async () => {
    if (selectedFiles.length === 0) {
      alert("Please select at least one file");
      return;
    }

    setGeneratingTests(true);

    try {
      
      const fileContents = await Promise.all(
        selectedFiles.map(async (file) => {
          const response = await axios.get(
            `http://localhost:3000/getFileContent/${owner}/${repo}?path=${file.path}`,
            { withCredentials: true }
          );
          return {
            path: file.path,
            content: response.data.content,
          };
        })
      );

      
      const aiResponse = await axios.post(
        "http://localhost:3000/generateTestSummary",
        { files: fileContents },
        { withCredentials: true }
      );
      console.log(aiResponse.data.summary);

      setTestSummary(aiResponse.data.summary);
    } catch (error) {
      console.error("Error generating test cases:", error);
      alert("Failed to generate test cases");
    } finally {
      setGeneratingTests(false);
    }
  };

  const raisePR = async () => {
    if (!fullTestCode || selectedFiles.length === 0) {
      alert("Generate full test code and select files first");
      return;
    }

    setRaisingPR(true);

    try {
      const filesToCommit = selectedFiles.map((f) => ({
        path: f.path,
        content: fullTestCode, 
      }));

      const response = await axios.post(
        "http://localhost:3000/raisePR",
        {
          owner,
          repo,
          files: filesToCommit,
          prTitle: "Add AI-generated tests",
          prBody: "Automatically generated test cases using AI.",
        },
        { withCredentials: true }
      );

      alert(`PR created! URL: ${response.data.prUrl}`);
    } catch (err) {
      console.error(err);
      alert("Failed to raise PR");
    } finally {
      setRaisingPR(false);
    }
  };

  if (loading) return <p>Loading files...</p>;

  return (
    <div className="app-container">
      <h2 className="repo-title">Files in {repo}</h2>

      <div className="selection-panel">
        <p className="selected-count">{selectedFiles.length} files selected</p>
        {selectedFiles.length > 0 && !testSummary && (
          <button
            onClick={generateTestSummary}
            disabled={generatingTests}
            className={`btn btn-primary ${generatingTests ? "disabled" : ""}`}
          >
            {generatingTests ? "Generating..." : "Generate Test Summary"}
          </button>
        )}
      </div>

      <div className="files-container">
        {files.map((file) => (
          <div
            key={file.path}
            className={`file-box ${
              selectedFiles.includes(file) ? "selected" : ""
            }`}
            onClick={() => handleFileSelect(file)}
          >
            {file.path}
          </div>
        ))}
      </div>

      <div className="markdown-container">
       
        {testSummary && !fullTestCode && (
          <ReactMarkdown
            children={testSummary}
            remarkPlugins={[remarkGfm]}
            components={
              {
                
              }
            }
          />
        )}

        {testSummary && !fullTestCode && (
          <div className="action-center">
            <button
              onClick={generateFullCode}
              disabled={generatingFullCode}
              className={`btn btn-secondary ${
                generatingFullCode ? "disabled" : ""
              }`}
            >
              {generatingFullCode ? "Generating..." : "Generate Full Code"}
            </button>
          </div>
        )}

        
        {fullTestCode && (
          <>
            <div className="full-code-container">
              <h3 className="full-code-title">Generated Test Code</h3>
              <ReactMarkdown
                children={fullTestCode}
                remarkPlugins={[remarkGfm]}
                components={
                  {
        
                  }
                }
              />
            </div>

            <div className="action-center">
              <button
                onClick={raisePR}
                disabled={raisingPR}
                className={`btn btn-success ${raisingPR ? "disabled" : ""}`}
              >
                {raisingPR ? "Raising PR..." : "Raise PR"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default RepoFiles;
