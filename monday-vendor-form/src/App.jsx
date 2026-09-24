import "./App.css";

function App() {
  return (
    <div className="app">
      <main className="content">
        <section className="assessment-card">
          <header className="header">
            <h1>Grand Prix Vendor Form</h1>
          </header>
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
