import express from "express";
import http from "http";
import { Server } from "socket.io";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { spawn } from "child_process";

// Load environment variables
dotenv.config();

// Define __dirname for ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Express app & server
const app = express();
const server = http.createServer(app);

// CORS Setup (Allow React Client)
const CLIENT_URL = process.env.CLIENT_URL || "http://localhost:3000";
app.use(cors({ origin: CLIENT_URL, credentials: true }));

// Initialize Socket.IO
const io = new Server(server, {
    cors: { origin: CLIENT_URL, methods: ["GET", "POST"] },
});

// Serve React Frontend in Production
if (process.env.NODE_ENV === "production") {
    app.use(express.static(path.join(__dirname, "../mr-white/build")));

    app.get("*", (req, res) => {
        res.sendFile(path.join(__dirname, "../mr-white/build/index.html"));
    });
}

// Health Check Route
app.get("/health", (req, res) => {
    res.status(200).json({ status: "ok" });
});

// Function to handle Ollama AI processing
async function runOllama(input, socket) {
    return new Promise((resolve, reject) => {
        const ollamaPath = "C:\\Users\\Goodwill\\AppData\\Local\\Programs\\ollama\\ollama.exe";
        const model = "codellama:latest";
        const args = ["run", model, input];

        console.log("Executing:", ollamaPath, args.join(" "));

        const childProcess = spawn(ollamaPath, args, {
            shell: true,
            stdio: ["pipe", "pipe", "pipe"]
        });

        let output = "";
        let isComplete = false;
        let lastResponseTime = Date.now();

        // Handle Ollama output
        childProcess.stdout.on("data", (data) => {
            const chunk = data.toString();
            output += chunk;
            lastResponseTime = Date.now();
            console.log("AI Response:", chunk);

            socket.emit("bot_response", { response: chunk, isComplete: false });
        });

        // Check for completion
        const checkCompletion = setInterval(() => {
            if (Date.now() - lastResponseTime > 2000 && output.length > 0) {
                isComplete = true;
                clearInterval(checkCompletion);
                childProcess.kill();

                socket.emit("bot_response", { response: "", isComplete: true });
                resolve(output.trim());
            }
        }, 1000);

        // Handle process completion
        childProcess.on("close", (code) => {
            clearInterval(checkCompletion);
            isComplete = true;
            if (code !== 0) reject(new Error(`Ollama exited with code ${code}`));
            else resolve(output.trim());
        });

        // Handle errors
        childProcess.on("error", (err) => reject(err));

        setTimeout(() => {
            if (!isComplete) {
                clearInterval(checkCompletion);
                childProcess.kill();
                reject(new Error("Ollama timeout"));
            }
        }, 100);
    });
}

// Socket.IO Handling
io.on("connection", (socket) => {
    console.log("New client connected");

    socket.on("message", async (data) => {
        try {
            console.log("User:", data.message);
            await runOllama(data.message, socket);
        } catch (error) {
            console.error("Ollama Error:", error);
            socket.emit("bot_response", { response: "Error processing request.", isComplete: true });
        }
    });

    socket.on("disconnect", () => {
        console.log("Client disconnected");
    });
});

// Start Server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
