import express, { type Request, Response, NextFunction } from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";

// Load environment variables
dotenv.config();

const app = express();
const port = parseInt(process.env.PORT || "5000", 10);

// Middleware
app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: false, limit: "10mb" }));

// Logging middleware
function log(message: string, source = "express") {
    const formattedTime = new Date().toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
        second: "2-digit",
        hour12: true,
    });
    console.log(`${formattedTime} [${source}] ${message}`);
}

app.use((req, res, next) => {
    const start = Date.now();
    res.on("finish", () => {
        const duration = Date.now() - start;
        if (req.path.startsWith("/api")) {
            log(`${req.method} ${req.path} ${res.statusCode} in ${duration}ms`);
        }
    });
    next();
});

// Health check endpoint
app.get("/api/health", (_req, res) => {
    res.json({ status: "healthy", timestamp: new Date().toISOString() });
});

// News API endpoints
app.get("/api/news", async (req: Request, res: Response) => {
    try {
        const newsService = await import("./newsService");
        const feed = await newsService.getNewsFeed();
        res.json(feed);
    } catch (error) {
        log(`Error fetching news: ${error}`);
        res.status(500).json({ message: "Failed to fetch news" });
    }
});

// Intelligence pipeline endpoint
app.get("/api/intelligence", async (req: Request, res: Response) => {
    try {
        const { runPipeline } = await import("./intelligence/core/pipeline");
        const date = (req.query.date as string) || new Date().toISOString().split("T")[0];

        const result = await runPipeline(date);
        res.json(result);
    } catch (error) {
        log(`Error running intelligence pipeline: ${error}`);
        res.status(500).json({ message: "Failed to run intelligence pipeline" });
    }
});

// GPR (Geopolitical Risk) endpoint
app.get("/api/intelligence/gpr", async (req: Request, res: Response) => {
    try {
        const { calculateGPR } = await import("./intelligence/metrics/gpr");
        const date = (req.query.date as string) || new Date().toISOString().split("T")[0];

        const gprData = await calculateGPR(date);
        res.json(gprData);
    } catch (error) {
        log(`Error calculating GPR: ${error}`);
        res.status(500).json({ message: "Failed to calculate GPR" });
    }
});

// Hindsight validator endpoint
app.get("/api/intelligence/hindsight", async (req: Request, res: Response) => {
    try {
        const { getBacktestData } = await import("./intelligence/validation/hindsight");
        const entity = req.query.entity as string;
        const days = parseInt(req.query.days as string) || 30;

        const data = await getBacktestData(entity, days);
        res.json(data);
    } catch (error) {
        log(`Error fetching hindsight data: ${error}`);
        res.status(500).json({ message: "Failed to fetch hindsight data" });
    }
});

// Entity sentiment endpoint
app.get("/api/intelligence/entities", async (req: Request, res: Response) => {
    try {
        const { getEntitySentiment } = await import("./intelligence/validation/entity-sentiment");
        const entity = req.query.entity as string;
        const days = parseInt(req.query.days as string) || 30;

        const data = await getEntitySentiment(entity, days);
        res.json(data);
    } catch (error) {
        log(`Error fetching entity sentiment: ${error}`);
        res.status(500).json({ message: "Failed to fetch entity sentiment" });
    }
});

// Narrative threads endpoint
app.get("/api/intelligence/threads", async (req: Request, res: Response) => {
    try {
        const { getNarrativeThreads } = await import("./intelligence/clustering/threading");
        const days = parseInt(req.query.days as string) || 7;

        const threads = await getNarrativeThreads(days);
        res.json(threads);
    } catch (error) {
        log(`Error fetching threads: ${error}`);
        res.status(500).json({ message: "Failed to fetch narrative threads" });
    }
});

// Error handler
app.use((err: any, req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";
    log(`Error ${status}: ${message} | ${req.method} ${req.path}`);
    res.status(status).json({ message });
});

// Start server
app.listen(port, "0.0.0.0", async () => {
    log(`News Intelligence Platform running on port ${port}`);

    // Initialize and run news pipeline on startup
    log("Running initial news pipeline sync...");
    try {
        const { runPipeline } = await import("./intelligence/core/pipeline");
        const today = new Date().toISOString().split("T")[0];
        await runPipeline(today);
        log("Initial pipeline sync complete");
    } catch (error) {
        log(`Initial pipeline sync failed: ${error}`);
    }

    // Schedule periodic refresh - every 6 hours
    setInterval(async () => {
        log("Running scheduled intelligence pipeline...");
        try {
            const { runPipeline } = await import("./intelligence/core/pipeline");
            const today = new Date().toISOString().split("T")[0];
            await runPipeline(today);
            log("Scheduled pipeline refresh complete");
        } catch (error) {
            log(`Scheduled pipeline failed: ${error}`);
        }
    }, 6 * 60 * 60 * 1000); // Every 6 hours
});

export default app;
