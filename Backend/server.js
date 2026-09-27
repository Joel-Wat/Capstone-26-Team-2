/* Code for the backend side of the files */

import express from "express";
import cors from "cors";
import crypto from "crypto";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

const forms = new Map();

//initial health check of the Form
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    message: "Grand Prix Vendor Form API is running",
  });
});

/* First API for creating the form using POST*/

app.post("/api/forms", (req, res) => {
  const { vendorName } = req.body;

  if (!vendorName) {
    return res.status(400).json({
      error: "Vendor name is required",
    });
  }

  const token = crypto.randomBytes(32).toString("hex");

  const form = {
    vendorName,
    status: "not_started",
    answers: null,
  };

  forms.set(token, form);

  res.status(201).json({
    vendorName: form.vendorName,
    status: form.status,
    token: token,
  });
});

/* Second API for loading the form using GET  */

app.get("/api/forms/:token", (req, res) => {
  const { token } = req.params;
  const form = forms.get(token);

  if (!form) {
    return res.status(404).json({
      error: "Form not found",
    });
  } else {
    res.status(200).json({
      vendorName: form.vendorName,
      status: form.status,
      token: token,
    });
  }
});

//Third API for posting the form to the user
app.post("/api/forms/:token/submit", (req, res) => {
  const { token } = req.params;
  const form = forms.get(token);

  if (!form) {
    return res.status(404).json({
      error: "form not found",
    });
  }

  const { answers } = req.body;

  if (!answers) {
    return res.status(400).json({
      error: "Please Answer all required fields",
    });
  }

  form.answers = answers;
  form.status = "submitted";

  res.status(200).json({
    vendorName: form.vendorName,
    status: form.status,
    answers: form.answers,
  });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
