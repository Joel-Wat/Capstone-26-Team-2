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

app.post("/api/forms", async (req, res) => {
  const { vendorName } = req.body;

  if (!vendorName) {
    return res.status(400).json({
      error: "Vendor name is required",
    });
  }

  const token = crypto.randomBytes(32).toString("hex");

  try {
    const mutation = `
      mutation ($boardId: ID! , $vendorName: String! ){
        create_item(
        board_id: $boardId
        item_name: $vendorName
        ) {
          id
          name
        }
      }
    `;


  const response = await fetch("https://api.monday.com/v2", {
      method: "POST",
      headers: {
        Authorization: process.env.MONDAY_API_TOKEN,
        "Content-Type": "application/json",
        "API-Version": "2026-07",
      },
      body: JSON.stringify({
        query: mutation,
        variables: {
          boardId: process.env.MONDAY_BOARD_ID,
          vendorName: vendorName,
        }
      }),
  });

  const data = await response.json();

  console.log("Monday response:", data);

  const mondayItemId = data.data.create_item.id;

  const form = {
    vendorName,
    status: "Form Created",
    answers: null,
    mondayItemId: mondayItemId,
  };

  forms.set(token, form);

  res.status(201).json({
    vendorName: form.vendorName,
    status: form.status,
    token: token,
    });
  }
  
  catch (error) {

    console.log("creation error:", error)

    return res.status(500).json({
      error: "Couldn't connect to Monday"
    });
  }


});

/* Second API for loading the form using GET  */

app.get("/api/forms/:token", (req, res) => {
  const { token } = req.params;
  const form = forms.get(token);

  if (!form) {
    return res.status(404).json({
      error: "Form not found",
    });
  }
  
  else {
    res.status(200).json({
    vendorName: form.vendorName,
    status: form.status,
    token: token,
    answers: form.answers,
    });
  }
});

//Third API for posting the form to the user
app.post("/api/forms/:token/submit", async (req, res) => {
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

  try {

    const columnValues = {
    status: {
      label: "Submitted",
    },
    text_mm7sxxyx: answers.service,
    text_mm7sngar: answers.contactName,
    text_mm7s2ada: answers.email,
    text_mm7s22a5: answers.department,
    text_mm7sgtj: answers.facilityName,
    numeric_mm7sys6v: Number(answers.phone),
    numeric_mm7s3fk7: Number(answers.emacNumber),
    date_mm7sva3c: {
      date: answers.connectionDate,
    },
    date_mm7sf00s: {
      date: answers.disconnectionDate,
    },
    };

    const mutation = `
      mutation ($boardId: ID!, $itemId: ID!, $columnValues: JSON!) {
        change_multiple_column_values(
          board_id: $boardId
          item_id: $itemId
          column_values: $columnValues
        ) {
        id
      }
    }
  `;

    const response = await fetch("https://api.monday.com/v2", {
      method: "POST",
      headers: {
        Authorization: process.env.MONDAY_API_TOKEN,
        "Content-Type": "application/json",
        "API-Version": "2026-07",
      },
      body: JSON.stringify({
        query: mutation,
        variables: {
          boardId: process.env.MONDAY_BOARD_ID,
          itemId: form.mondayItemId,
          columnValues: JSON.stringify(columnValues),
        }
      }),
  });

    const data = await response.json();
    
    console.log("Monday submission response:", data);

    if (data.errors) {
      throw new Error(JSON.stringify(data.errors));
    }


    form.answers = answers;
    form.status = "submitted";

    return res.status(200).json({
      vendorName: form.vendorName,
      status: form.status,
      answers: form.answers,
    });

  


} catch (error) {
  console.error("Monday submission error:", error);

  return res.status(500).json({
    error: "Could not update Monday",
  });
}
});




//!!!!!!!!!!!!!!!!!!!!!!!!!!!!!! MONDAY API TESTS, WILL REMOVE/COMMENT OUT !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!

app.get("/api/monday/board", async (req, res) => {
  try {
    const query = `
      query {
        boards(ids: [${process.env.MONDAY_BOARD_ID}]) {
          id
          name
          columns {
            id
            title
            type
          }
        }
      }
    `;

    const response = await fetch("https://api.monday.com/v2", {
      method: "POST",
      headers: {
        Authorization: process.env.MONDAY_API_TOKEN,
        "Content-Type": "application/json",
        "API-Version": "2026-07",
      },
      body: JSON.stringify({
        query: query,
      }),
    });

    const data = await response.json();

    res.json(data);
  } catch (error) {
    console.error("Monday API error:", error);

    res.status(500).json({
      error: "Could not connect to Monday API",
    });
  }
});

app.post("/api/monday/test-item", async (req, res) => {
try{
  const { vendorName } = req.body;

  if (!vendorName) {
    return res.status(400).json({
      error: "Vendor name is required",
    });
  }

  const mutation = `
      mutation ($boardId: ID! , $vendorName: String! ){
        create_item(
        board_id: $boardId
        item_name: $vendorName
        ) {
          id
          name
        }
      }
    `;


  const response = await fetch("https://api.monday.com/v2", {
      method: "POST",
      headers: {
        Authorization: process.env.MONDAY_API_TOKEN,
        "Content-Type": "application/json",
        "API-Version": "2026-07",
      },
      body: JSON.stringify({
        query: mutation,
        variables: {
          boardId: process.env.MONDAY_BOARD_ID,
          vendorName: vendorName,
        }
      }),
  });

  const data = await response.json();

  res.json(data);

}
catch (error) {
    console.error("Monday API error:", error);

    res.status(500).json({
      error: "Could not connect to Monday API",
    });
}
});

app.post("/api/monday/test-status", async (req, res) => {
  try {

const mutation = `
  mutation ($boardId: ID! , $itemId: ID!, $columnValues: JSON! ) {
    change_multiple_column_values(
      board_id: $boardId
      item_id: $itemId
      column_values: $columnValues
    ) {
      id
    }
  }
`;

const columnValues = {
  status: {
    label: "Submitted",
  },
};

const response = await fetch("https://api.monday.com/v2", {
      method: "POST",
      headers: {
        Authorization: process.env.MONDAY_API_TOKEN,
        "Content-Type": "application/json",
        "API-Version": "2026-07",
      },
      body: JSON.stringify({
        query: mutation,
        variables: {
          boardId: process.env.MONDAY_BOARD_ID,
          itemId: "2872712364",
          columnValues: JSON.stringify(columnValues),
        }
      }),
  });

  const data = await response.json();


return res.json(data);


  } catch (error) {
    console.error("Monday status update error:", error);

    return res.status(500).json({
      error: "Could not update Monday item",
    });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
