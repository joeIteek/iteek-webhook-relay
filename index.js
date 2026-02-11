import express from "express";

const app = express();
app.use(express.json({ limit: "1mb" }));

const PORT = process.env.PORT || 3000;

app.get("/", (req, res) => res.status(200).send("ok"));

app.post("/webhooks/systeme/optin", async (req, res) => {
  try {
    const secret = req.headers["x-webhook-secret"];
    if (process.env.SYSTEME_WEBHOOK_SECRET && secret !== process.env.SYSTEME_WEBHOOK_SECRET) {
      return res.status(401).json({ error: "unauthorized" });
    }

    const p = req.body || {};
    const lead = {
      first_name: p.first_name || p.firstname || "",
      last_name: p.last_name || p.lastname || "",
      email: p.email || "",
      phone: p.phone || p.tel || "",
      job_type: p.job_type || p.service || "service",
      suburb_city: p.city || p.suburb || "",
      postcode: p.postcode || p.zip || "",
      urgency: p.urgency || "this_week",
      description: p.description || p.message || ""
    };

    const createUrl = `${process.env.CRM_API_BASE_URL}${process.env.CRM_CREATE_LEAD_PATH || "/api/leads/create"}`;
    const createResp = await fetch(createUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(process.env.CRM_API_KEY ? { "Authorization": `Bearer ${process.env.CRM_API_KEY}` } : {})
      },
      body: JSON.stringify(lead)
    });

    if (!createResp.ok) {
      const text = await createResp.text();
      return res.status(500).json({ error: "crm_create_failed", details: text });
    }

    const data = await createResp.json();
    const opportunity_id = data.opportunity_id;
    if (!opportunity_id) return res.status(500).json({ error: "missing_opportunity_id", details: data });

    const triggerUrl = `${process.env.CRM_API_BASE_URL}${process.env.SPEED_TO_LEAD_TRIGGER_PATH || "/trigger-speed-to-lead"}`;
    await fetch(triggerUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ opportunity_id })
    });

    return res.status(200).json({ ok: true, opportunity_id });
  } catch (e) {
    return res.status(500).json({ error: "exception", message: String(e) });
  }
});

app.listen(PORT, "0.0.0.0", () => console.log(`Listening on ${PORT}`));
