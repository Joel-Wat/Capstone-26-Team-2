import { useState } from "react";
import "./App.css";

function App() {
  const [vendorName, setVendorName] = useState("");

  const [status, setStatus] = useState("Not started");

  const [token, setToken] = useState("");

  const [vendorFormLink, setVendorFormLink] = useState("");

  const createForm = async () => {
    try {
      const response = await fetch("http://localhost:3000/api/forms", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          vendorName: vendorName,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        alert(data.error);
        return;
      }

      setStatus(data.status);
      setToken(data.token);

      console.log("Form created:", data);
    } catch (error) {
      console.error("Error creating form:", error);
      alert("Could not connect to the backend.");
    }
  };

  const generateVendorLink = () => {
    if (!token) {
      alert("Please create a form first.");
      return;
    }

    //THIS WILL BE CHANGED FROM LOCAL HOST TO EXTERNAL HOSTING PLATFORM
    const link = `http://localhost:5174/form/${token}`;

    setVendorFormLink(link);
  };

  return (
    <div className="app">
      <main className="content">
        <section className="assessment-card">
          <header className="header">
            <h1>Grand Prix Vendor Form</h1>
          </header>

          <div className="form-group">
            <label htmlFor="vendor">Enter Vendor</label>

            <input
              id="vendor"
              type="text"
              placeholder="Enter vendor name"
              value={vendorName}
              onChange={(event) => setVendorName(event.target.value)}
            />
          </div>

          <div className="actions">
            <button type="button" onClick={createForm}>
              Create Form
            </button>

            <button
              type="button"
              className="secondary"
              onClick={generateVendorLink}
            >
              Generate Vendor Form Link
            </button>
          </div>

          <div className="status">
            <strong>Status:</strong> {status}
          </div>

          {vendorFormLink && (
            <div className="vendor-link">
              <strong>Vendor Form Link:</strong>
              <p>
                <a
                  href={vendorFormLink}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {vendorFormLink}
                </a>
              </p>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

export default App;
