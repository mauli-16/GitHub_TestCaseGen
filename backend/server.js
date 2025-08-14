const express = require("express");
const axios = require("axios");
const cors = require("cors");
const dotenv = require("dotenv");
const cookieParser = require("cookie-parser");
const { GoogleGenerativeAI } = require("@google/generative-ai");
dotenv.config();
const app = express();
const port = 3000;

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;
app.use(cookieParser());
app.use(cors({
    origin: "http://localhost:5173", 
    credentials: true
}));
app.use(express.json());

app.get("/getAccessToken", async (req, res) => {
  const code = req.query.code;
  if (!code) {
    return res.status(400).json({ error: "Code is required" });
  }

  try {
    const tokenResponse = await axios.post(
      "https://github.com/login/oauth/access_token",
      {
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        code: code,
      },
      {
        headers: { Accept: "application/json" },
      }
    );
    res.cookie("gh_token", tokenResponse.data.access_token, {
      httpOnly: true,
      secure: false,
      sameSite: "lax",
    });

    res.redirect("http://localhost:5173/dashboard");
  } catch (error) {
    console.error(error.response?.data || error.message);
    res.status(500).json({ error: "Failed to get access token" });
  }
});

app.get("/getRepos", async (req, res) => {
  const accessToken = req.cookies.gh_token; 
  if (!accessToken) {
    return res.status(401).json({ error: "No access token" });
  }

  try {
    const response = await axios.get("https://api.github.com/user/repos", {
      headers: { Authorization: `token ${accessToken}` },
    });
    res.json(response.data);
  } catch (error) {
    console.error(error.response?.data || error.message);
    res.status(500).json({ error: "Failed to fetch repos" });
  }
});


app.get("/getAllRepoFiles/:owner/:repo", async (req, res) => {
  const { owner, repo } = req.params;
  const accessToken = req.cookies.gh_token;
  
  try {
   
    const repoInfo = await axios.get(
      `https://api.github.com/repos/${owner}/${repo}`,
      { headers: { Authorization: `token ${accessToken}` } }
    );
    
   
    const treeResponse = await axios.get(
      `https://api.github.com/repos/${owner}/${repo}/git/trees/${repoInfo.data.default_branch}?recursive=1`,
      { headers: { Authorization: `token ${accessToken}` } }
    );
    
    const codeExtensions = [
      '.js', '.jsx', '.ts', '.tsx', '.py', '.java', '.cpp', '.c', 
      '.html', '.css', '.php', '.rb', '.go'
    ];
    
    
    const excludeDirs = [
      "node_modules",
      "dist",
      "build",
      ".next",
      "out",
      "coverage",
      "__pycache__"
    ];
    
    const codeFiles = treeResponse.data.tree.filter(item => {
      if (item.type !== 'blob') return false;
      
     
      if (excludeDirs.some(dir => item.path.includes(dir))) return false;
    
    
      return codeExtensions.some(ext => 
        item.path.toLowerCase().endsWith(ext)
      );
    });
    
    res.json(codeFiles);
  } catch (error) {
    console.error("Error fetching code files:", error.response?.data || error.message);
    res.status(500).json({ error: "Failed to fetch code files" });
  }
});

//get file content
app.get("/getFileContent/:owner/:repo", async (req, res) => {
  const { owner, repo } = req.params;
  const path = req.query.path;
  const accessToken = req.cookies.gh_token;
  
  if (!accessToken) {
    return res.status(401).json({ error: "No access token" });
  }

  if (!path) {
    return res.status(400).json({ error: "File path is required" });
  }

  try {
    const response = await axios.get(
      `https://api.github.com/repos/${owner}/${repo}/contents/${path}`,
      {
        headers: { Authorization: `token ${accessToken}` },
      }
    );
    
 
    const content = Buffer.from(response.data.content, 'base64').toString('utf-8');
    
    res.json({
      name: response.data.name,
      path: response.data.path,
      content: content,
      size: response.data.size
    });
  } catch (error) {
    console.error("Error fetching file content:", error.response?.data || error.message);
    res.status(500).json({ error: "Failed to fetch file content" });
  }
});

//generate test summary
app.post("/generateTestSummary", async (req, res) => {
  const { files } = req.body; 

  if (!files || files.length === 0) {
    return res.status(400).json({ error: "No files provided" });
  }

  try {
    
    const prompt = `
      For the following files, generate a high-level summary of test cases
      (without writing the full code). 
      Each test case should include:
      - Test case name
      - Purpose
      - Input
      - Expected Output

      Files:
      ${files.map(f => `File: ${f.path}\n${f.content}`).join("\n\n")}
    `;
   
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const result = await model.generateContent(prompt);

    const text = result.response.text();

    res.json({ summary: text });
  } catch (err) {
    console.error("Error generating test summary:", err);
    res.status(500).json({ error: "Failed to generate test summary" });
  }
});




app.post("/generateFullTestCode", async (req, res) => {
  const { files, testSummary, framework = "Jest" } = req.body;

  if (!testSummary) {
    return res.status(400).json({ error: "Test summary is required" });
  }

  try {
    let prompt = `
      Convert the following test case summary into fully working ${framework} test code.
      Include imports, setup, and mock dependencies as needed.
      Ensure the tests are runnable immediately.

      Test Summary:
      ${testSummary}
    `;

   
    if (files && files.length > 0) {
      prompt += `\n\nOriginal Source Files for Reference:\n`;
      prompt += files.map(f => `File: ${f.path}\n${f.content}`).join("\n\n");
    }

    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const result = await model.generateContent(prompt);

    res.json({ fullCode: result.response.text() }); 
  } catch (err) {
    console.error("Error generating test code:", err);
    
    if (err.status === 429) {
      res.status(429).json({ 
        error: 'Rate limit exceeded. Please try again later.',
        details: 'Too many requests to AI service. Please wait a few minutes.'
      });
    } else {
      res.status(500).json({ error: "Failed to generate test code" });
    }
  }
});


app.post("/raisePR", async (req, res) => {
  const { owner, repo, branchName, files, prTitle, prBody } = req.body;
  const accessToken = req.cookies.gh_token;

  if (!accessToken) return res.status(401).json({ error: "No access token" });
  if (!files || files.length === 0) return res.status(400).json({ error: "No files provided" });
  if (!owner || !repo) return res.status(400).json({ error: "Owner and repo are required" });

  try {
    
    const repoInfo = await axios.get(`https://api.github.com/repos/${owner}/${repo}`, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    const defaultBranch = repoInfo.data.default_branch;

    const defaultBranchRef = await axios.get(
      `https://api.github.com/repos/${owner}/${repo}/git/refs/heads/${defaultBranch}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    const baseSha = defaultBranchRef.data.object.sha;


    const newBranchName = branchName || `auto-test-${Date.now()}`;
    try {
      await axios.get(
        `https://api.github.com/repos/${owner}/${repo}/git/refs/heads/${newBranchName}`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
    } catch (err) {
      if (err.response?.status === 404) {
        await axios.post(
          `https://api.github.com/repos/${owner}/${repo}/git/refs`,
          { ref: `refs/heads/${newBranchName}`, sha: baseSha },
          { headers: { Authorization: `Bearer ${accessToken}` } }
        );
      } else {
        throw err;
      }
    }

    for (const file of files) {
      let currentSha;
      try {
        const fileInfo = await axios.get(
          `https://api.github.com/repos/${owner}/${repo}/contents/${file.path}?ref=${newBranchName}`,
          { headers: { Authorization: `Bearer ${accessToken}` } }
        );
        currentSha = fileInfo.data.sha;
      } catch {
        currentSha = undefined;
      }

      const fileData = {
        message: `Update ${file.path}`,
        content: Buffer.from(file.content).toString("base64"),
        branch: newBranchName,
      };

      if (currentSha) fileData.sha = currentSha;

      await axios.put(
        `https://api.github.com/repos/${owner}/${repo}/contents/${file.path}`,
        fileData,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
    }

    
    const existingPRs = await axios.get(
      `https://api.github.com/repos/${owner}/${repo}/pulls?head=${owner}:${newBranchName}&state=open`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    if (existingPRs.data.length > 0) {
      return res.json({
        success: true,
        prUrl: existingPRs.data[0].html_url,
        prNumber: existingPRs.data[0].number,
        message: "Files updated in existing PR"
      });
    }

    
    const prResponse = await axios.post(
      `https://api.github.com/repos/${owner}/${repo}/pulls`,
      {
        title: prTitle || "Auto-generated code updates",
        head: newBranchName,
        base: defaultBranch,
        body: prBody || "This PR contains automatically generated code updates.",
      },
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    res.json({
      success: true,
      prUrl: prResponse.data.html_url,
      prNumber: prResponse.data.number,
      branchName: newBranchName
    });

  } catch (err) {
    res.status(err.response?.status || 500).json({
      error: "Failed to create PR",
      details: err.response?.data || err.message
    });
  }
});


app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
