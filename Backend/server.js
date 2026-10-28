/* Code for the backend side of the files */

import express from "express";
import cors from "cors";
import crypto from "crypto";
import dotenv from "dotenv";
import multer from "multer";
import { fileTypeFromBuffer } from "file-type";
import { SecretsManager } from "@mondaycom/apps-sdk";

dotenv.config();

const secretsManager = new SecretsManager();

const MONDAY_API_TOKEN =
  secretsManager.get("MONDAY_API_TOKEN") ?? process.env.MONDAY_API_TOKEN;

const MONDAY_BOARD_ID =
  secretsManager.get("MONDAY_BOARD_ID") ?? process.env.MONDAY_BOARD_ID;

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

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024,
  },
});

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

  // This creates the form on Monday.com
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
        Authorization: MONDAY_API_TOKEN,
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

    const data = await response.json();

    if (!response.ok || data.errors?.length || !data.data?.create_item?.id) {
      console.error("Monday create_item failed:", {
        status: response.status,
        errors: data.errors,
        error_code: data.error_code,
        error_message: data.error_message,
      });

      throw new Error("Monday could not create the vendor item");
    }

    /* This feature is entirely for referncing the form for safekeeping and storage */

    const mondayItemId = data.data.create_item.id;

    const referenceNumber = Number(mondayItemId);

    const referenceColumnValues = {
      numeric_mm85y4vb: referenceNumber,
    };

    const referenceMutation = `
      mutation ($boardId: ID!, $itemId: ID!, $columnValues: JSON! ){
        change_multiple_column_values(
          board_id: $boardId
          item_id: $itemId
          column_values: $columnValues
        ) {
          id
        }
      }
    `;

    const referenceResponse = await fetch("https://api.monday.com/v2", {
      method: "POST",
      headers: {
        Authorization: MONDAY_API_TOKEN,
        "Content-Type": "application/json",
        "API-Version": "2026-07",
      },
      body: JSON.stringify({
        query: referenceMutation,
        variables: {
          boardId: MONDAY_BOARD_ID,
          itemId: mondayItemId,
          columnValues: JSON.stringify(referenceColumnValues),
        },
      }),
    });

    const referenceData = await referenceResponse.json();

    if (
      !referenceResponse.ok ||
      referenceData.errors?.length ||
      !referenceData.data?.change_multiple_column_values?.id
    ) {
      throw new Error("Failed to save form reference number");
    }

    //This is for the backend to store the data between pages
    const form = {
      vendorName,
      status: "Form Created",
      answers: null,
      mondayItemId: mondayItemId,
      referenceNumber,
    };

    forms.set(token, form);

    res.status(201).json({
      vendorName: form.vendorName,
      status: form.status,
      token: token,
      referenceNumber,
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
      referenceNumber: form.referenceNumber,
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

  const { answers } = req.body ?? {};

  if (answers == null) {
    return res.status(400).json({
      error: "Please answer all required fields",
    });
  }

  if (typeof answers !== "object" || Array.isArray(answers)) {
    return res.status(400).json({
      error: "Invalid form answers",
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
      const isValidPhone = /^\+?[0-9 ]+$/.test(answers.phone);

      if (!isValidPhone) {
        return res.status(400).json({
          error: "Invalid phone number",
        });
      } else {
        columnValues.phone_mm7yvb7b = {
          phone: answers.phone,
          countryShortName: "AU",
        };
      }
    }

    let emacNumber = answers.emacNumber;

    const isValid = /^[0-9]+$/.test(emacNumber);

    if (!isValid) {
      return res.status(400).json({
        error: "EMAC Number must be numeric",
      });
    }

    emacNumber = Number(answers.emacNumber);

    if (!Number.isFinite(emacNumber)) {
      return res.status(400).json({
        error: "EMAC Number must be numeric",
      });
    }

    columnValues.numeric_mm7s3fk7 = emacNumber;

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

    res.status(200).json({
      vendorName: form.vendorName,
      status: form.status,
      answers: form.answers,
    });
  } catch (error) {
    console.error("Monday submission error:", error);

    return res.status(500).json({
      error: "Could not submit form to Monday.com",
    });
  }
});

app.post(
  "/api/forms/:token/upload",
  (req, res, next) => {
    upload.single("serviceSketch")(req, res, (error) => {
      if (error) {
        if (error instanceof multer.MulterError) {
          return res.status(400).json({
            error:
              error.code === "LIMIT_FILE_SIZE"
                ? "File must be smaller than 5 MB"
                : error.message,
          });
        }

        return res.status(400).json({
          error: "File upload failed",
        });
      }

      next();
    });
  },
  async (req, res) => {
    const { token } = req.params;
    const form = forms.get(token);

    if (!form) {
      return res.status(404).json({
        error: "Form not found",
      });
    }

    if (!req.file) {
      return res.status(400).json({
        error: "Please upload a Location/Service Sketch",
      });
    }

    const allowedTypes = ["image/jpeg", "image/png", "application/pdf"];

    if (!allowedTypes.includes(req.file.mimetype)) {
      return res.status(400).json({
        error: "Only PNG, JPG and PDF files are allowed",
      });
    }

    try {
      const detectedType = await fileTypeFromBuffer(req.file.buffer);

      if (!detectedType || !allowedTypes.includes(detectedType.mime)) {
        return res.status(400).json({
          error: "Invalid file type",
        });
      }

      if (detectedType.mime !== req.file.mimetype) {
        return res.status(400).json({
          error: "File type does not match file contents",
        });
      }

      const mutation = `
        mutation ($file: File!, $itemId: ID!, $columnId: String!) {
          add_file_to_column(
            file: $file
            item_id: $itemId
            column_id: $columnId
          ) {
            id
          }
        }
      `;

      const uploadData = new FormData();

      uploadData.append("query", mutation);

      uploadData.append(
        "variables",
        JSON.stringify({
          itemId: form.mondayItemId,
          columnId: "file_mm7wx8c4",
          file: null,
        }),
      );

      uploadData.append(
        "map",
        JSON.stringify({
          0: ["variables.file"],
        }),
      );

      const fileBlob = new Blob([req.file.buffer], { type: detectedType.mime });

      uploadData.append("0", fileBlob, req.file.originalname);

      const response = await fetch("https://api.monday.com/v2/file", {
        method: "POST",
        headers: {
          Authorization: MONDAY_API_TOKEN,
          "API-Version": "2026-07",
        },
        body: uploadData,
      });

      const data = await response.json();

      if (
        !response.ok ||
        data.errors?.length ||
        !data.data?.add_file_to_column?.id
      ) {
        console.error("Monday file upload failed:", data);

        return res.status(500).json({
          error: "Could not upload file to Monday.com",
        });
      }

      return res.status(200).json({
        message: "File uploaded successfully",
        fileId: data.data.add_file_to_column.id,
      });
    } catch (error) {
      console.error("File upload error:", error);

      return res.status(500).json({
        error: "File upload failed",
      });
    }
  },
);

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
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

/* app.get("/api/monday/board-structure", async (req, res) => {
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

*/
