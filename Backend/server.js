/* Code for the backend side of the files */

import express from "express";
import cors from "cors";
import crypto from "crypto";
import dotenv from "dotenv";
import { SecretsManager } from "@mondaycom/apps-sdk";


dotenv.config();

const secretsManager = new SecretsManager();

const MONDAY_API_TOKEN =
  secretsManager.get("MONDAY_API_TOKEN") ??
  process.env.MONDAY_API_TOKEN;

const MONDAY_BOARD_ID =
  secretsManager.get("MONDAY_BOARD_ID") ??
  process.env.MONDAY_BOARD_ID;

//Logging for Variables
/*
console.log("Monday environment check:", {
  tokenConfigured: Boolean(process.env.MONDAY_API_TOKEN),
  boardConfigured: Boolean(process.env.MONDAY_BOARD_ID),
});

console.log("Monday credentials check:", {
  tokenExists: Boolean(process.env.MONDAY_API_TOKEN),
  tokenLength: process.env.MONDAY_API_TOKEN?.length ?? 0,
  boardIdExists: Boolean(process.env.MONDAY_BOARD_ID),
}); */

console.log("Monday SDK secrets check:", {
  tokenConfigured: Boolean(MONDAY_API_TOKEN),
  boardConfigured: Boolean(MONDAY_BOARD_ID),
});

const app = express();
const PORT = process.env.PORT || 8080;


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
        Authorization:  MONDAY_API_TOKEN,
        "Content-Type": "application/json",
        "API-Version": "2026-07",
      },
      body: JSON.stringify({
        query: mutation,
        variables: {
          boardId: MONDAY_BOARD_ID,
          vendorName: vendorName,
        },
      }),
    });

    

    //Testing log
    /* console.log("Monday response:", data); */

    const data = await response.json();

if (
  !response.ok ||
  data.errors?.length ||
  !data.data?.create_item?.id
) {
  console.error("Monday create_item failed:", {
    status: response.status,
    errors: data.errors,
    error_code: data.error_code,
    error_message: data.error_message,
  });

  throw new Error("Monday could not create the vendor item");
}

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
  } catch (error) {
    console.log("creation error:", error);

    return res.status(500).json({
      error: "Couldn't connect to Monday",
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
  } else {
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

  const serviceGroups = {
    Telecommunications: "topics",
    "Printer & Equipment": "group_mm7wqep9",
    "Event Technology": "group_mm7wtyzz",
    Phones: "group_mm7y54s9",
  };

  const groupId = serviceGroups[answers.service];

  if (!groupId) {
    return res.status(400).json({
      error: "Invalid service selected",
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
    };
    if (answers.phone) {
      columnValues.phone_mm7yvb7b = {
        phone: answers.phone,
        countryShortName: "AU",
      };
    }

    if (answers.emacNumber) {
      const emacNumber = Number(answers.emacNumber);

      if (!Number.isFinite(emacNumber)) {
        return res.status(400).json({
          error: "EMAC Number must be numeric",
        });
      }

      columnValues.numeric_mm7s3fk7 = emacNumber;
    }

    if (answers.service === "Telecommunications") {
      columnValues.text_mm7s22a5 = answers.department;
      columnValues.text_mm7sgtj = answers.facilityName;

      columnValues.date_mm7sva3c = {
        date: answers.connectionDate,
      };

      columnValues.date_mm7sf00s = {
        date: answers.disconnectionDate,
      };
    } else if (
      answers.service === "Phones" ||
      answers.service === "Event Technology"
    ) {
      columnValues.text_mm7ybwdv = answers.emacDescription;

      columnValues.long_text_mm7y1drs = {
        text: answers.additionalInfo,
      };
    }

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
        Authorization: MONDAY_API_TOKEN,
        "Content-Type": "application/json",
        "API-Version": "2026-07",
      },
      body: JSON.stringify({
        query: mutation,
        variables: {
          boardId: MONDAY_BOARD_ID,
          itemId: form.mondayItemId,
          columnValues: JSON.stringify(columnValues),
        },
      }),
    });

    const data = await response.json();

    //Testing logs
    /* console.log("Monday submission response:", data); */

    if (
      !response.ok ||
      data.errors?.length ||
      !data.data?.change_multiple_column_values?.id
    ) {
      throw new Error(JSON.stringify(data));
    }
    const groupMutation = `
  mutation ($itemId: ID!, $groupId: String!) {
    move_item_to_group(
      item_id: $itemId
      group_id: $groupId
    ) {
      id
    }
  }
`;

    const groupResponse = await fetch("https://api.monday.com/v2", {
      method: "POST",
      headers: {
        Authorization: MONDAY_API_TOKEN,
        "Content-Type": "application/json",
        "API-Version": "2026-07",
      },
      body: JSON.stringify({
        query: groupMutation,
        variables: {
          itemId: form.mondayItemId,
          groupId: groupId,
        },
      }),
    });

    const groupData = await groupResponse.json();

    if (
      !groupResponse.ok ||
      groupData.errors?.length ||
      !groupData.data?.move_item_to_group?.id
    ) {
      throw new Error(JSON.stringify(groupData));
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

/*
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
  try {
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
        },
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
        },
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
}); */

app.get("/api/monday/board-structure", async (req, res) => {
  try {
    const query = `
      query ($boardId: [ID!]) {
        boards(ids: $boardId) {
          id
          name
          groups {
            id
            title
          }
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
        Authorization: MONDAY_API_TOKEN,
        "Content-Type": "application/json",
        "API-Version": "2026-07",
      },
      body: JSON.stringify({
        query: query,
        variables: {
          boardId: [MONDAY_BOARD_ID],
        },
      }),
    });

    const data = await response.json();

    return res.json(data);
  } catch (error) {
    console.error("Board structure error:", error);

    return res.status(500).json({
      error: "Could not retrieve Monday board structure",
    });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
