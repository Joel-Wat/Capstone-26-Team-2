import "./App.css";

function App() {
  return (
    <div className="app">
      <header className="header">
        <h1>Grand Prix Vendor Form</h1>
        <p>Manage vendor forms</p>
      </header>

      <main className="content">
        <section className="assessment-card">
          <h2>Vendor Assessment</h2>

          <div className="form-group">
            <label htmlFor="vendor">Enter Vendor</label>
            <input id="vendor" type="text" placeholder="Enter vendor name" />
          </div>

          <div className="actions">
            <button type="button">Create Form</button>
            <button type="button" className="secondary">
              Generate Vendor Form Link
            </button>
          </div>

          <div className="status">
            <strong>Status:</strong> Not started
          </div>
        </section>
      </main>
    </div>
  );
}

export default App;
