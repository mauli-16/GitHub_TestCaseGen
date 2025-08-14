import { useEffect, useState } from "react";
import reactLogo from "./assets/react.svg";
import viteLogo from "/vite.svg";
import "./App.css";

const CLIENT_ID = "Ov23li3yOxJFAB8YlmiP";

function App() {
  function loginWithGithub() {
    window.location.assign(
`https://github.com/login/oauth/authorize?client_id=${CLIENT_ID}&scope=repo,user:email` 
    );
  }
  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get("code");
    if (code) {
      window.location.assign(
        `http://localhost:3000/getAccessToken?code=${code}`
      );
    }
  }, []);

  return (
    <>
      <div className="login-container">
      <p>Login to your GitHub first to access repositories</p>
      <button onClick={loginWithGithub}>Login with GitHub</button>
    </div>
    </>
  );
}

export default App;
